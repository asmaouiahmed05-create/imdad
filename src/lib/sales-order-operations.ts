import "server-only";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";

type TransactionClient = PrismaTypes.TransactionClient;

export class SalesOrderError extends Error {}

function scaledQuantity(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    return null;
  }
  const scaled = Math.round(value * 1_000_000);
  return Number.isSafeInteger(scaled) ? BigInt(scaled) : null;
}

export function calculateAvailableQuantity(onHand: number, reserved: number) {
  const onHandScaled = scaledQuantity(onHand);
  const reservedScaled = scaledQuantity(reserved);
  if (onHandScaled === null || reservedScaled === null) return null;
  return Number(onHandScaled - reservedScaled) / 1_000_000;
}

export async function lockInventoryProducts(
  tx: TransactionClient,
  productIds: readonly string[],
) {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Product"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `;
}

async function activeReservationsByProduct(
  tx: TransactionClient,
  productIds: readonly string[],
) {
  if (productIds.length === 0) return new Map<string, number>();
  const reservations = await tx.customerOrderReservation.groupBy({
    by: ["productId"],
    where: {
      productId: { in: [...new Set(productIds)] },
      releasedAt: null,
    },
    _sum: { quantity: true },
  });
  return new Map(
    reservations.map((reservation) => [
      reservation.productId,
      reservation._sum.quantity ?? 0,
    ]),
  );
}

export async function assertUnreservedStockAvailable(
  tx: TransactionClient,
  requirements: readonly {
    productId: string;
    productName: string;
    quantity: number;
  }[],
) {
  const productIds = [...new Set(requirements.map((item) => item.productId))];
  if (productIds.length === 0) return;
  const [products, reservations] = await Promise.all([
    tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, quantity: true },
    }),
    activeReservationsByProduct(tx, productIds),
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const requirement of requirements) {
    const product = productsById.get(requirement.productId);
    if (!product) {
      throw new SalesOrderError(`الصنف «${requirement.productName}» غير موجود.`);
    }
    const available = calculateAvailableQuantity(
      product.quantity,
      reservations.get(requirement.productId) ?? 0,
    );
    const required = scaledQuantity(requirement.quantity);
    const availableScaled = available === null ? null : scaledQuantity(available);
    if (
      required === null ||
      availableScaled === null ||
      availableScaled < required
    ) {
      const displayedAvailable =
        available === null ? 0 : Math.max(available, 0);
      throw new SalesOrderError(
        `المخزون غير كافٍ للصنف «${requirement.productName}». الكمية المتاحة ${displayedAvailable}.`,
      );
    }
  }
}

async function lockCustomerOrder(tx: TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CustomerOrder" WHERE "id" = ${id} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new SalesOrderError("طلب العميل غير موجود.");
  }
}

async function releaseReservations(
  tx: TransactionClient,
  order: {
    id: string;
    lines: { id: string; productId: string; orderedQuantity: number }[];
  },
  reason: "FULFILLED" | "CANCELLED",
  now: Date,
) {
  const reservations = await tx.customerOrderReservation.findMany({
    where: { orderId: order.id, releasedAt: null },
    select: { id: true, orderLineId: true, productId: true, quantity: true },
  });
  if (reservations.length !== order.lines.length) {
    throw new SalesOrderError("تعذّر مطابقة حجوزات المخزون مع أصناف الطلب.");
  }

  const linesById = new Map(order.lines.map((line) => [line.id, line]));
  for (const reservation of reservations) {
    const line = linesById.get(reservation.orderLineId);
    const lineQuantity = line ? scaledQuantity(line.orderedQuantity) : null;
    const reservedQuantity = scaledQuantity(reservation.quantity);
    if (
      !line ||
      line.productId !== reservation.productId ||
      lineQuantity === null ||
      reservedQuantity === null ||
      lineQuantity !== reservedQuantity
    ) {
      throw new SalesOrderError("بيانات حجز المخزون غير متطابقة مع الطلب.");
    }
  }

  const released = await tx.customerOrderReservation.updateMany({
    where: { orderId: order.id, releasedAt: null },
    data: { releasedAt: now, releaseReason: reason },
  });
  if (released.count !== reservations.length) {
    throw new SalesOrderError("تغيرت حجوزات الطلب. حدّث الصفحة وحاول مرة أخرى.");
  }
}

export async function confirmCustomerOrderInTransaction(
  tx: TransactionClient,
  id: string,
  now = new Date(),
) {
  await lockCustomerOrder(tx, id);
  const order = await tx.customerOrder.findUnique({
    where: { id },
    include: { lines: true, customer: { select: { isActive: true } } },
  });
  if (!order) throw new SalesOrderError("طلب العميل غير موجود.");
  if (order.status === "CONFIRMED") return;
  if (order.status !== "DRAFT") {
    throw new SalesOrderError("يمكن تأكيد المسودات فقط.");
  }
  if (!order.customer.isActive) {
    throw new SalesOrderError("لا يمكن تأكيد طلب عميل غير نشط.");
  }
  if (order.lines.length === 0) {
    throw new SalesOrderError("أضف صنفًا واحدًا على الأقل قبل تأكيد الطلب.");
  }

  await lockInventoryProducts(
    tx,
    order.lines.map((line) => line.productId),
  );
  const sellableProducts = await tx.product.count({
    where: {
      id: { in: order.lines.map((line) => line.productId) },
      classification: { in: ["FINISHED_GOOD", "BOTH"] },
    },
  });
  if (sellableProducts !== order.lines.length) {
    throw new SalesOrderError(
      "تغير تصنيف أحد المنتجات ولم يعد صالحًا لطلبات العملاء.",
    );
  }
  await assertUnreservedStockAvailable(
    tx,
    order.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.orderedQuantity,
    })),
  );

  await tx.customerOrderReservation.createMany({
    data: order.lines.map((line) => ({
      orderId: order.id,
      orderLineId: line.id,
      productId: line.productId,
      quantity: line.orderedQuantity,
    })),
  });
  const updated = await tx.customerOrder.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "CONFIRMED", confirmedAt: now },
  });
  if (updated.count !== 1) {
    throw new SalesOrderError("تغيرت حالة الطلب. حدّث الصفحة وحاول مرة أخرى.");
  }
}

export async function fulfillCustomerOrderInTransaction(
  tx: TransactionClient,
  id: string,
  now = new Date(),
) {
  await lockCustomerOrder(tx, id);
  const order = await tx.customerOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!order) throw new SalesOrderError("طلب العميل غير موجود.");
  if (order.status === "FULFILLED") return;
  if (order.status !== "CONFIRMED") {
    throw new SalesOrderError("يمكن إكمال الطلبات المؤكدة فقط.");
  }

  await lockInventoryProducts(
    tx,
    order.lines.map((line) => line.productId),
  );
  const reservations = await tx.customerOrderReservation.findMany({
    where: { orderId: id, releasedAt: null },
    select: { productId: true, quantity: true },
  });
  if (reservations.length !== order.lines.length) {
    throw new SalesOrderError("تعذّر مطابقة حجوزات المخزون مع أصناف الطلب.");
  }

  for (const line of order.lines) {
    const reservation = reservations.find(
      (item) => item.productId === line.productId,
    );
    const lineQuantity = scaledQuantity(line.orderedQuantity);
    const reservedQuantity = reservation
      ? scaledQuantity(reservation.quantity)
      : null;
    if (
      !reservation ||
      lineQuantity === null ||
      reservedQuantity === null ||
      reservedQuantity !== lineQuantity
    ) {
      throw new SalesOrderError("بيانات حجز المخزون غير متطابقة مع الطلب.");
    }

    const deducted = await tx.product.updateMany({
      where: { id: line.productId, quantity: { gte: reservation.quantity } },
      data: { quantity: { decrement: reservation.quantity } },
    });
    if (deducted.count !== 1) {
      throw new SalesOrderError(
        `الرصيد الفعلي للصنف «${line.productName}» لا يكفي لإكمال الطلب.`,
      );
    }
    await tx.stockMovement.create({
      data: {
        customerOrderId: order.id,
        productId: line.productId,
        type: "OUT",
        quantity: reservation.quantity,
        reason: `صرف طلب العميل ${order.orderNumber}`,
        reference: order.orderNumber,
      },
    });
  }

  await releaseReservations(tx, order, "FULFILLED", now);
  const updated = await tx.customerOrder.updateMany({
    where: { id, status: "CONFIRMED" },
    data: { status: "FULFILLED", fulfilledAt: now },
  });
  if (updated.count !== 1) {
    throw new SalesOrderError("تغيرت حالة الطلب. حدّث الصفحة وحاول مرة أخرى.");
  }
}

export async function cancelCustomerOrderInTransaction(
  tx: TransactionClient,
  id: string,
  now = new Date(),
) {
  await lockCustomerOrder(tx, id);
  const order = await tx.customerOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!order) throw new SalesOrderError("طلب العميل غير موجود.");
  if (order.status === "CANCELLED") return;
  if (order.status === "FULFILLED") {
    throw new SalesOrderError("لا يمكن إلغاء طلب مكتمل. تُعالج المرتجعات بمسار مستقل.");
  }

  if (order.status === "CONFIRMED") {
    await lockInventoryProducts(
      tx,
      order.lines.map((line) => line.productId),
    );
    await releaseReservations(tx, order, "CANCELLED", now);
  } else {
    const activeReservationCount = await tx.customerOrderReservation.count({
      where: { orderId: id, releasedAt: null },
    });
    if (activeReservationCount !== 0) {
      throw new SalesOrderError("توجد حجوزات غير متوقعة في مسودة الطلب.");
    }
  }

  const updated = await tx.customerOrder.updateMany({
    where: { id, status: order.status },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  if (updated.count !== 1) {
    throw new SalesOrderError("تغيرت حالة الطلب. حدّث الصفحة وحاول مرة أخرى.");
  }
}

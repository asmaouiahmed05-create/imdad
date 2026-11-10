"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  cancelCustomerOrderInTransaction,
  confirmCustomerOrderInTransaction,
  fulfillCustomerOrderInTransaction,
  SalesOrderError,
} from "@/lib/sales-order-operations";
import {
  MAX_CUSTOMER_ORDER_LINES,
  parseCustomerOrderDate,
  parseCustomerOrderLines,
} from "@/lib/sales-order-state";

type ActionResult = { ok: boolean; id?: string; error?: string };
type OrderLineInput = { productId: string; quantity: number };
type TransactionClient = Prisma.TransactionClient;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalField(
  formData: FormData,
  name: string,
  label: string,
  maxLength: number,
) {
  const value = field(formData, name);
  if (value.length > maxLength) {
    throw new SalesOrderError(`يجب ألا يتجاوز حقل ${label} ${maxLength} حرفًا.`);
  }
  return value || null;
}

function customerFields(formData: FormData, requireStatus = false) {
  const name = field(formData, "name").replace(/\s+/gu, " ");
  if (!name) throw new SalesOrderError("اسم العميل مطلوب.");
  if (name.length > 160) {
    throw new SalesOrderError("يجب ألا يتجاوز اسم العميل 160 حرفًا.");
  }

  const email = optionalField(formData, "email", "البريد الإلكتروني", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new SalesOrderError("أدخل عنوان بريد إلكتروني صالحًا.");
  }
  const rawActive = formData.get("isActive");
  if (
    (requireStatus && rawActive === null) ||
    (rawActive !== null && rawActive !== "true" && rawActive !== "false")
  ) {
    throw new SalesOrderError("حالة العميل غير صالحة.");
  }

  return {
    name,
    contactPerson: optionalField(formData, "contactPerson", "جهة الاتصال", 120),
    phone: optionalField(formData, "phone", "الهاتف", 40),
    email,
    city: optionalField(formData, "city", "المدينة", 120),
    address: optionalField(formData, "address", "العنوان", 300),
    notes: optionalField(formData, "notes", "الملاحظات", 2000),
    isActive: rawActive !== "false",
  };
}

function orderLines(formData: FormData) {
  const productIds = formData
    .getAll("productId")
    .map((value) => String(value));
  const quantities = formData
    .getAll("quantity")
    .map((value) => String(value));
  return parseCustomerOrderLines(productIds, quantities);
}

function orderFields(formData: FormData) {
  const customerId = field(formData, "customerId");
  if (!customerId) throw new SalesOrderError("اختر عميلًا.");

  const lines = orderLines(formData);
  if (!lines.ok) throw new SalesOrderError(lines.error);
  if (lines.lines.length > MAX_CUSTOMER_ORDER_LINES) {
    throw new SalesOrderError(
      `لا يمكن أن يتجاوز طلب العميل ${MAX_CUSTOMER_ORDER_LINES} صنفًا.`,
    );
  }

  const rawExpectedDate = field(formData, "expectedFulfillmentDate");
  const expectedFulfillmentAt = parseCustomerOrderDate(rawExpectedDate);
  if (expectedFulfillmentAt === undefined) {
    throw new SalesOrderError("أدخل تاريخ الإنجاز المتوقع بصورة صحيحة.");
  }

  const notes = field(formData, "notes");
  if (notes.length > 2000) {
    throw new SalesOrderError("يجب ألا تتجاوز الملاحظات 2000 حرف.");
  }

  return {
    customerId,
    lines: lines.lines,
    expectedFulfillmentAt,
    notes: notes || null,
  };
}

function prismaErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function actionError(error: unknown, fallback: string): ActionResult {
  if (error instanceof SalesOrderError) {
    return { ok: false, error: error.message };
  }
  console.error("Customer sales order operation failed", {
    code: prismaErrorCode(error),
  });
  return { ok: false, error: fallback };
}

function revalidateSales(orderId?: string) {
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/production");
  revalidatePath("/purchase-orders");
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath("/sales/customers");
  revalidatePath("/control-tower");
  if (orderId) revalidatePath(`/sales/orders/${orderId}`);
}

async function activeCustomer(
  tx: TransactionClient,
  customerId: string,
  allowInactive = false,
) {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, isActive: true },
  });
  if (!customer || (!customer.isActive && !allowInactive)) {
    throw new SalesOrderError("العميل غير موجود أو غير نشط.");
  }
  return customer;
}

async function productSnapshots(
  tx: TransactionClient,
  lines: readonly OrderLineInput[],
) {
  const products = await tx.product.findMany({
    where: {
      id: { in: lines.map((line) => line.productId) },
      classification: { in: ["FINISHED_GOOD", "BOTH"] },
    },
    select: { id: true, name: true, sku: true, unit: true },
  });
  if (products.length !== lines.length) {
    throw new SalesOrderError(
      "تعذّر العثور على أحد المنتجات النهائية المحددة.",
    );
  }
  const productsById = new Map(products.map((product) => [product.id, product]));
  return lines.map((line) => {
    const product = productsById.get(line.productId);
    if (!product) {
      throw new SalesOrderError("المنتج المحدد غير متاح لطلبات العملاء.");
    }
    return {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unit: product.unit,
      orderedQuantity: line.quantity,
    };
  });
}

function orderYear(date: Date) {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  })
    .formatToParts(date)
    .find((part) => part.type === "year")?.value;
  if (!year) throw new Error("Could not determine the customer order year");
  return year;
}

function isIdempotencyKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}

function sameOrderInput(
  order: {
    customerId: string;
    expectedFulfillmentAt: Date | null;
    notes: string | null;
    lines: { productId: string; orderedQuantity: number }[];
  },
  input: ReturnType<typeof orderFields>,
) {
  if (
    order.customerId !== input.customerId ||
    order.notes !== input.notes ||
    order.expectedFulfillmentAt?.getTime() !==
      input.expectedFulfillmentAt?.getTime() ||
    order.lines.length !== input.lines.length
  ) {
    return false;
  }
  const existingLines = new Map(
    order.lines.map((line) => [line.productId, line.orderedQuantity]),
  );
  return input.lines.every(
    (line) => existingLines.get(line.productId) === line.quantity,
  );
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  await requirePermission("sales.customer.manage");

  try {
    const created = await prisma.customer.create({
      data: customerFields(formData),
      select: { id: true },
    });
    revalidateSales();
    return { ok: true, id: created.id };
  } catch (error) {
    return actionError(error, "تعذّر حفظ بيانات العميل. حاول مرة أخرى.");
  }
}

export async function updateCustomer(formData: FormData): Promise<ActionResult> {
  await requirePermission("sales.customer.manage");

  const id = field(formData, "id");
  if (!id) return { ok: false, error: "العميل غير محدد." };

  try {
    await prisma.customer.update({
      where: { id },
      data: customerFields(formData, true),
      select: { id: true },
    });
    revalidateSales();
    return { ok: true, id };
  } catch (error) {
    if (prismaErrorCode(error) === "P2025") {
      return { ok: false, error: "العميل غير موجود." };
    }
    return actionError(error, "تعذّر تحديث بيانات العميل. حاول مرة أخرى.");
  }
}

export async function createCustomerOrder(
  formData: FormData,
): Promise<ActionResult> {
  const principal = await requirePermission("sales.order.manage");
  const idempotencyKey = field(formData, "idempotencyKey");
  if (!isIdempotencyKey(idempotencyKey)) {
    return { ok: false, error: "تعذّر التحقق من طلب الحفظ. حدّث الصفحة وحاول مجددًا." };
  }

  let input: ReturnType<typeof orderFields>;
  try {
    input = orderFields(formData);
  } catch (error) {
    return actionError(error, "تعذّر التحقق من بيانات الطلب.");
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const prior = await tx.customerOrder.findUnique({
        where: {
          createdByUserId_idempotencyKey: {
            createdByUserId: principal.id,
            idempotencyKey,
          },
        },
        include: { lines: true },
      });
      if (prior) {
        if (!sameOrderInput(prior, input)) {
          throw new SalesOrderError(
            "أُعيد استخدام مفتاح طلب الحفظ مع بيانات مختلفة.",
          );
        }
        return { id: prior.id };
      }

      const customer = await activeCustomer(tx, input.customerId);
      const lines = await productSnapshots(tx, input.lines);
      const [sequence] = await tx.$queryRaw<Array<{ value: string }>>`
        SELECT nextval('"CustomerOrder_orderNumber_seq"')::text AS value
      `;
      if (!sequence) throw new Error("Customer order sequence returned no value");
      const orderNumber = `SO-${orderYear(new Date())}-${sequence.value.padStart(6, "0")}`;
      const order = await tx.customerOrder.create({
        data: {
          orderNumber,
          idempotencyKey,
          customerId: customer.id,
          customerName: customer.name,
          createdByUserId: principal.id,
          expectedFulfillmentAt: input.expectedFulfillmentAt,
          notes: input.notes,
          lines: { create: lines },
        },
        select: { id: true },
      });
      return order;
    });
    revalidateSales(created.id);
    return { ok: true, id: created.id };
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      const prior = await prisma.customerOrder.findUnique({
        where: {
          createdByUserId_idempotencyKey: {
            createdByUserId: principal.id,
            idempotencyKey,
          },
        },
        include: { lines: true },
      });
      if (prior && sameOrderInput(prior, input)) {
        revalidateSales(prior.id);
        return { ok: true, id: prior.id };
      }
    }
    return actionError(error, "تعذّر إنشاء مسودة الطلب. حاول مرة أخرى.");
  }
}

export async function updateCustomerOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("sales.order.manage");

  const id = field(formData, "id");
  const expectedUpdatedAt = new Date(field(formData, "expectedUpdatedAt"));
  if (!id) return { ok: false, error: "طلب العميل غير محدد." };
  if (
    !Number.isFinite(expectedUpdatedAt.getTime()) ||
    expectedUpdatedAt.toISOString() !== field(formData, "expectedUpdatedAt")
  ) {
    return { ok: false, error: "بيانات النسخة غير صالحة. حدّث الصفحة." };
  }

  let input: ReturnType<typeof orderFields>;
  try {
    input = orderFields(formData);
  } catch (error) {
    return actionError(error, "تعذّر التحقق من بيانات الطلب.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "CustomerOrder" WHERE "id" = ${id} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new SalesOrderError("طلب العميل غير موجود.");
      }
      const current = await tx.customerOrder.findUnique({
        where: { id },
        select: { status: true, updatedAt: true, customerId: true },
      });
      if (!current || current.status !== "DRAFT") {
        throw new SalesOrderError("يمكن تعديل المسودات فقط.");
      }
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new SalesOrderError(
          "عُدّل الطلب في جلسة أخرى. حدّث الصفحة ثم أعد التغييرات.",
        );
      }
      const reservationCount = await tx.customerOrderReservation.count({
        where: { orderId: id },
      });
      if (reservationCount !== 0) {
        throw new SalesOrderError("لا يمكن تعديل طلب له سجل حجز مخزون.");
      }

      const customer = await activeCustomer(
        tx,
        input.customerId,
        current.customerId === input.customerId,
      );
      const lines = await productSnapshots(tx, input.lines);
      const updated = await tx.customerOrder.updateMany({
        where: { id, status: "DRAFT", updatedAt: expectedUpdatedAt },
        data: {
          customerId: customer.id,
          customerName: customer.name,
          expectedFulfillmentAt: input.expectedFulfillmentAt,
          notes: input.notes,
        },
      });
      if (updated.count !== 1) {
        throw new SalesOrderError(
          "تغيرت بيانات الطلب. حدّث الصفحة وحاول مرة أخرى.",
        );
      }
      await tx.customerOrderLine.deleteMany({ where: { orderId: id } });
      await tx.customerOrderLine.createMany({
        data: lines.map((line) => ({ ...line, orderId: id })),
      });
    });

    revalidateSales(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر تحديث مسودة الطلب. حاول مرة أخرى.");
  }
}

async function transitionOrder(
  id: string,
  operation: (
    tx: TransactionClient,
    orderId: string,
  ) => Promise<void>,
): Promise<ActionResult> {
  await requirePermission("sales.order.manage");
  if (!id.trim()) return { ok: false, error: "طلب العميل غير محدد." };

  try {
    await prisma.$transaction((tx) => operation(tx, id));
    revalidateSales(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر تحديث حالة الطلب. حاول مرة أخرى.");
  }
}

export async function confirmCustomerOrder(id: string): Promise<ActionResult> {
  return transitionOrder(id, (tx, orderId) =>
    confirmCustomerOrderInTransaction(tx, orderId),
  );
}

export async function fulfillCustomerOrder(id: string): Promise<ActionResult> {
  return transitionOrder(id, (tx, orderId) =>
    fulfillCustomerOrderInTransaction(tx, orderId),
  );
}

export async function cancelCustomerOrder(id: string): Promise<ActionResult> {
  return transitionOrder(id, (tx, orderId) =>
    cancelCustomerOrderInTransaction(tx, orderId),
  );
}

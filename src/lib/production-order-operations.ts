import type { Prisma as PrismaTypes } from "@prisma/client";
import {
  calculateMaterialRequirements,
  parseProductionOrderQuantity,
} from "./production-orders.ts";
import {
  assertUnreservedStockAvailable,
  lockInventoryProducts,
} from "./sales-order-operations.ts";

type TransactionClient = PrismaTypes.TransactionClient;

export class ProductionOrderError extends Error {}

async function lockOrder(tx: TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "ProductionOrder" WHERE "id" = ${id} FOR UPDATE
  `;
  if (rows.length === 0) throw new ProductionOrderError("أمر الإنتاج غير موجود");
}

async function lockBom(tx: TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "BillOfMaterials" WHERE "id" = ${id} FOR SHARE
  `;
  if (rows.length === 0) throw new ProductionOrderError("قائمة المواد غير موجودة");
}

async function lockedOrderWithBom(tx: TransactionClient, id: string) {
  const order = await tx.productionOrder.findUnique({
    where: { id },
    include: { bom: { include: { components: true } } },
  });
  if (!order) throw new ProductionOrderError("أمر الإنتاج غير موجود");
  return order;
}

function requirementsFor(
  order: {
    bom: {
      finishedProductId: string;
      components: {
        materialProductId: string;
        quantityPerUnit: { toString(): string };
        materialName: string;
        materialSku: string;
        unit: string;
      }[];
    };
  },
  quantity: unknown,
) {
  const result = calculateMaterialRequirements(
    order.bom.components.map((component) => ({
      materialProductId: component.materialProductId,
      quantityPerUnit: component.quantityPerUnit.toString(),
      materialName: component.materialName,
      materialSku: component.materialSku,
      unit: component.unit,
    })),
    quantity,
    order.bom.finishedProductId,
  );
  if (!result.ok) throw new ProductionOrderError(result.error);
  return result.requirements;
}

export async function startProductionOrderInTransaction(
  tx: TransactionClient,
  id: string,
  now = new Date(),
) {
  await lockOrder(tx, id);
  const order = await lockedOrderWithBom(tx, id);
  if (order.status !== "DRAFT") {
    throw new ProductionOrderError("يمكن بدء أوامر المسودة فقط");
  }

  await lockBom(tx, order.bomId);
  const bom = await tx.billOfMaterials.findUnique({
    where: { id: order.bomId },
    select: { status: true, releasedAt: true },
  });
  if (!bom || bom.status !== "RELEASED" || !bom.releasedAt) {
    throw new ProductionOrderError("يجب اختيار مراجعة قائمة مواد معتمدة");
  }

  const requirements = requirementsFor(order, order.plannedQuantity.toString());
  await lockInventoryProducts(
    tx,
    requirements.map((requirement) => requirement.materialProductId),
  );
  await assertUnreservedStockAvailable(
    tx,
    requirements.map((requirement) => ({
      productId: requirement.materialProductId,
      productName: requirement.materialName,
      quantity: requirement.requiredQuantity,
    })),
  );

  await tx.productionOrder.update({
    where: { id },
    data: { status: "IN_PROGRESS", startedAt: now },
  });
}

export async function completeProductionOrderInTransaction(
  tx: TransactionClient,
  id: string,
  rawProducedQuantity: unknown,
  now = new Date(),
) {
  const producedQuantity = parseProductionOrderQuantity(rawProducedQuantity);
  if (producedQuantity === null) {
    throw new ProductionOrderError("أدخل كمية إنتاج فعلية أكبر من صفر وصالحة");
  }

  await lockOrder(tx, id);
  const order = await lockedOrderWithBom(tx, id);
  if (order.status !== "IN_PROGRESS") {
    throw new ProductionOrderError("يمكن إكمال أوامر قيد الإنتاج فقط");
  }
  if (producedQuantity > Number(order.plannedQuantity)) {
    throw new ProductionOrderError("لا يمكن أن تتجاوز الكمية الفعلية الكمية المخططة");
  }

  await lockBom(tx, order.bomId);
  const bom = await tx.billOfMaterials.findUnique({
    where: { id: order.bomId },
    select: { status: true, releasedAt: true },
  });
  if (
    !bom?.releasedAt ||
    (bom.status !== "RELEASED" && bom.status !== "RETIRED")
  ) {
    throw new ProductionOrderError("مراجعة قائمة المواد لم تعد صالحة للإنتاج");
  }

  const requirements = requirementsFor(order, producedQuantity);
  const productIds = [
    order.bom.finishedProductId,
    ...requirements.map((requirement) => requirement.materialProductId),
  ];
  await lockInventoryProducts(tx, productIds);
  const products = await tx.product.findMany({
    where: { id: { in: [...new Set(productIds)] } },
    select: { id: true, quantity: true },
  });
  await assertUnreservedStockAvailable(
    tx,
    requirements.map((requirement) => ({
      productId: requirement.materialProductId,
      productName: requirement.materialName,
      quantity: requirement.requiredQuantity,
    })),
  );

  const productById = new Map(products.map((product) => [product.id, product]));
  const finishedProduct = productById.get(order.bom.finishedProductId);
  if (!finishedProduct || finishedProduct.quantity + producedQuantity > 1_000_000_000) {
    throw new ProductionOrderError("ستتجاوز كمية المنتج النهائي الحد المسموح");
  }

  for (const requirement of requirements) {
    const updated = await tx.product.updateMany({
      where: {
        id: requirement.materialProductId,
        quantity: { gte: requirement.requiredQuantity },
      },
      data: { quantity: { decrement: requirement.requiredQuantity } },
    });
    if (updated.count !== 1) {
      throw new ProductionOrderError(
        `المخزون غير كافٍ للمادة «${requirement.materialName}»`,
      );
    }
    await tx.stockMovement.create({
      data: {
        productId: requirement.materialProductId,
        productionOrderId: id,
        type: "OUT",
        quantity: requirement.requiredQuantity,
        reason: `استهلاك إنتاجي - أمر ${order.orderNumber}`,
        reference: order.orderNumber,
      },
    });
  }

  const produced = await tx.product.updateMany({
    where: { id: order.bom.finishedProductId },
    data: { quantity: { increment: producedQuantity } },
  });
  if (produced.count !== 1) {
    throw new ProductionOrderError("المنتج النهائي غير موجود");
  }
  await tx.stockMovement.create({
    data: {
      productId: order.bom.finishedProductId,
      productionOrderId: id,
      type: "IN",
      quantity: producedQuantity,
      reason: `إنتاج نهائي - أمر ${order.orderNumber}`,
      reference: order.orderNumber,
    },
  });
  await tx.productionOrder.update({
    where: { id },
    data: {
      status: "COMPLETED",
      producedQuantity,
      completedAt: now,
    },
  });
}

export async function cancelProductionOrderInTransaction(
  tx: TransactionClient,
  id: string,
  now = new Date(),
) {
  await lockOrder(tx, id);
  const order = await tx.productionOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order || (order.status !== "DRAFT" && order.status !== "IN_PROGRESS")) {
    throw new ProductionOrderError("لا يمكن إلغاء أمر الإنتاج في حالته الحالية");
  }
  await tx.productionOrder.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: now },
  });
}

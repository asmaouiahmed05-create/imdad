"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { isRecordId } from "@/lib/production-bom";
import { prisma } from "@/lib/db";
import {
  cancelProductionOrderInTransaction,
  completeProductionOrderInTransaction,
  ProductionOrderError,
  startProductionOrderInTransaction,
} from "@/lib/production-order-operations";
import { SalesOrderError } from "@/lib/sales-order-operations";
import {
  calculateMaterialRequirements,
  parseProductionOrderQuantity,
} from "@/lib/production-orders";

type ActionResult = { ok: boolean; id?: string; error?: string };

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : undefined;
}

function orderYear(date: Date) {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  })
    .formatToParts(date)
    .find((part) => part.type === "year")?.value;
  if (!year) throw new Error("Could not determine the production order year");
  return year;
}

function prismaErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function actionError(error: unknown, fallback: string): ActionResult {
  if (error instanceof ProductionOrderError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof SalesOrderError) {
    return { ok: false, error: error.message };
  }
  console.error("Production order operation failed", {
    code: prismaErrorCode(error),
  });
  return { ok: false, error: fallback };
}

function revalidateProduction(id?: string) {
  revalidatePath("/production");
  revalidatePath("/reports");
  revalidatePath("/");
  if (id) revalidatePath(`/production/orders/${id}`);
}

export async function createProductionOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("production.order.manage");

  const bomId = field(formData, "bomId");
  const plannedQuantity = parseProductionOrderQuantity(
    field(formData, "plannedQuantity"),
  );
  const plannedStartDate = parseDate(field(formData, "plannedStartDate"));
  const expectedCompletionDate = parseDate(
    field(formData, "expectedCompletionDate"),
  );
  const notes = field(formData, "notes") || null;

  if (!isRecordId(bomId)) return { ok: false, error: "اختر قائمة مواد صالحة" };
  if (plannedQuantity === null) {
    return { ok: false, error: "أدخل كمية مخططة أكبر من صفر وصالحة" };
  }
  if (plannedStartDate === undefined || expectedCompletionDate === undefined) {
    return { ok: false, error: "أدخل تواريخ إنتاج صالحة" };
  }
  if (
    plannedStartDate &&
    expectedCompletionDate &&
    expectedCompletionDate < plannedStartDate
  ) {
    return { ok: false, error: "يجب ألا يسبق تاريخ الإنجاز تاريخ بدء الإنتاج" };
  }
  if (notes && notes.length > 2000) {
    return { ok: false, error: "يجب ألا تتجاوز الملاحظات 2000 حرف" };
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "BillOfMaterials" WHERE "id" = ${bomId} FOR SHARE
      `;
      if (locked.length === 0) {
        throw new ProductionOrderError("قائمة المواد غير موجودة");
      }
      const bom = await tx.billOfMaterials.findUnique({
        where: { id: bomId },
        include: { components: true },
      });
      if (!bom || bom.status !== "RELEASED" || !bom.releasedAt) {
        throw new ProductionOrderError(
          "اختر مراجعة قائمة مواد معتمدة ونشطة",
        );
      }
      const calculation = calculateMaterialRequirements(
        bom.components.map((component) => ({
          materialProductId: component.materialProductId,
          quantityPerUnit: component.quantityPerUnit.toString(),
          materialName: component.materialName,
          materialSku: component.materialSku,
          unit: component.unit,
        })),
        plannedQuantity,
        bom.finishedProductId,
      );
      if (!calculation.ok) throw new ProductionOrderError(calculation.error);

      const [sequence] = await tx.$queryRaw<Array<{ value: string }>>`
        SELECT nextval('"ProductionOrder_orderNumber_seq"')::text AS value
      `;
      if (!sequence) {
        throw new Error("Production order sequence returned no value");
      }
      const orderNumber = `PR-${orderYear(new Date())}-${sequence.value.padStart(7, "0")}`;
      return tx.productionOrder.create({
        data: {
          orderNumber,
          bomId,
          plannedQuantity,
          plannedStartDate,
          expectedCompletionDate,
          notes,
        },
        select: { id: true },
      });
    });

    revalidateProduction(order.id);
    return { ok: true, id: order.id };
  } catch (error) {
    return actionError(error, "تعذّر إنشاء أمر الإنتاج، حاول مرة أخرى");
  }
}

export async function updateProductionOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("production.order.manage");

  const id = field(formData, "orderId");
  const bomId = field(formData, "bomId");
  const plannedQuantity = parseProductionOrderQuantity(
    field(formData, "plannedQuantity"),
  );
  const plannedStartDate = parseDate(field(formData, "plannedStartDate"));
  const expectedCompletionDate = parseDate(
    field(formData, "expectedCompletionDate"),
  );
  const notes = field(formData, "notes") || null;

  if (!isRecordId(id)) return { ok: false, error: "أمر الإنتاج غير صالح" };
  if (!isRecordId(bomId)) return { ok: false, error: "اختر قائمة مواد صالحة" };
  if (plannedQuantity === null) {
    return { ok: false, error: "أدخل كمية مخططة أكبر من صفر وصالحة" };
  }
  if (plannedStartDate === undefined || expectedCompletionDate === undefined) {
    return { ok: false, error: "أدخل تواريخ إنتاج صالحة" };
  }
  if (
    plannedStartDate &&
    expectedCompletionDate &&
    expectedCompletionDate < plannedStartDate
  ) {
    return { ok: false, error: "يجب ألا يسبق تاريخ الإنجاز تاريخ بدء الإنتاج" };
  }
  if (notes && notes.length > 2000) {
    return { ok: false, error: "يجب ألا تتجاوز الملاحظات 2000 حرف" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lockedOrder = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ProductionOrder" WHERE "id" = ${id} FOR UPDATE
      `;
      if (lockedOrder.length === 0) {
        throw new ProductionOrderError("أمر الإنتاج غير موجود");
      }
      const existing = await tx.productionOrder.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing || existing.status !== "DRAFT") {
        throw new ProductionOrderError("يمكن تعديل أوامر المسودة فقط");
      }

      const lockedBom = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "BillOfMaterials" WHERE "id" = ${bomId} FOR SHARE
      `;
      if (lockedBom.length === 0) {
        throw new ProductionOrderError("قائمة المواد غير موجودة");
      }
      const bom = await tx.billOfMaterials.findUnique({
        where: { id: bomId },
        include: { components: true },
      });
      if (!bom || bom.status !== "RELEASED" || !bom.releasedAt) {
        throw new ProductionOrderError(
          "اختر مراجعة قائمة مواد معتمدة ونشطة",
        );
      }
      const calculation = calculateMaterialRequirements(
        bom.components.map((component) => ({
          materialProductId: component.materialProductId,
          quantityPerUnit: component.quantityPerUnit.toString(),
          materialName: component.materialName,
          materialSku: component.materialSku,
          unit: component.unit,
        })),
        plannedQuantity,
        bom.finishedProductId,
      );
      if (!calculation.ok) throw new ProductionOrderError(calculation.error);

      await tx.productionOrder.update({
        where: { id },
        data: {
          bomId,
          plannedQuantity,
          plannedStartDate,
          expectedCompletionDate,
          notes,
        },
      });
    });

    revalidateProduction(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر تحديث أمر الإنتاج، حاول مرة أخرى");
  }
}

export async function startProductionOrder(id: string): Promise<ActionResult> {
  await requirePermission("production.order.manage");
  if (!isRecordId(id)) return { ok: false, error: "أمر الإنتاج غير صالح" };

  try {
    await prisma.$transaction((tx) =>
      startProductionOrderInTransaction(tx, id),
    );
    revalidateProduction(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر بدء أمر الإنتاج، حاول مرة أخرى");
  }
}

export async function completeProductionOrder(
  id: string,
  producedQuantity: string,
): Promise<ActionResult> {
  await requirePermission("production.order.manage");
  if (!isRecordId(id)) return { ok: false, error: "أمر الإنتاج غير صالح" };

  try {
    await prisma.$transaction((tx) =>
      completeProductionOrderInTransaction(tx, id, producedQuantity),
    );
    revalidateProduction(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر إكمال أمر الإنتاج، حاول مرة أخرى");
  }
}

export async function cancelProductionOrder(id: string): Promise<ActionResult> {
  await requirePermission("production.order.manage");
  if (!isRecordId(id)) return { ok: false, error: "أمر الإنتاج غير صالح" };

  try {
    await prisma.$transaction((tx) =>
      cancelProductionOrderInTransaction(tx, id),
    );
    revalidateProduction(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر إلغاء أمر الإنتاج، حاول مرة أخرى");
  }
}

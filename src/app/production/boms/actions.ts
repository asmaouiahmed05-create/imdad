"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  canEditBom,
  classificationAllowsBomUse,
  getBomStatusTransition,
  isRecordId,
  nextBomRevision,
  validateBomComponents,
} from "@/lib/production-bom";

class BomActionError extends Error {}

type ParsedBom = {
  finishedProductId: string;
  sourceId: string | null;
  components: { materialProductId: string; quantityPerUnit: number }[];
};

function parseBomForm(formData: FormData): ParsedBom | string {
  const finishedProductId = String(
    formData.get("finishedProductId") ?? "",
  ).trim();
  const rawIds = formData.getAll("materialProductId");
  const rawQuantities = formData.getAll("quantityPerUnit");
  const sourceValue = String(formData.get("sourceId") ?? "").trim();
  const sourceId = sourceValue || null;

  if (!isRecordId(finishedProductId)) {
    return "اختر منتجًا نهائيًا صالحًا";
  }
  if (sourceId && !isRecordId(sourceId)) {
    return "مرجع المراجعة السابقة غير صالح";
  }
  if (rawIds.length !== rawQuantities.length) {
    return "بيانات مكونات قائمة المواد غير مكتملة";
  }

  const validation = validateBomComponents(
    rawIds.map((materialProductId, index) => ({
      materialProductId,
      quantityPerUnit: rawQuantities[index],
    })),
    finishedProductId,
  );
  if (!validation.ok) return validation.error;

  return {
    finishedProductId,
    sourceId,
    components: validation.components,
  };
}

async function lockProducts(
  tx: Prisma.TransactionClient,
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

async function lockBom(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "BillOfMaterials"
    WHERE "id" = ${id}
    FOR UPDATE
  `;
}

async function getValidatedComponentSnapshots(
  tx: Prisma.TransactionClient,
  finishedProductId: string,
  components: ParsedBom["components"],
) {
  await lockProducts(tx, [
    finishedProductId,
    ...components.map((component) => component.materialProductId),
  ]);
  const products = await tx.product.findMany({
    where: {
      id: {
        in: [
          finishedProductId,
          ...components.map((component) => component.materialProductId),
        ],
      },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      classification: true,
    },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const finishedProduct = productsById.get(finishedProductId);

  if (
    !finishedProduct ||
    !classificationAllowsBomUse(finishedProduct.classification, "finished")
  ) {
    throw new BomActionError(
      "يجب تصنيف المنتج النهائي كمنتج نهائي أو كمادة ومنتج نهائي",
    );
  }

  return components.map((component) => {
    const material = productsById.get(component.materialProductId);
    if (
      !material ||
      !classificationAllowsBomUse(material.classification, "material")
    ) {
      throw new BomActionError(
        "كل مكوّن يجب أن يكون مصنفًا كمادة أولية أو كمادة ومنتج نهائي",
      );
    }
    return {
      ...component,
      materialName: material.name,
      materialSku: material.sku,
      unit: material.unit,
    };
  });
}

export async function createBom(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requirePermission("production.bom.manage");
  const parsed = parseBomForm(formData);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  try {
    const id = await prisma.$transaction(async (tx) => {
      const finishedProductId = parsed.finishedProductId;
      if (parsed.sourceId) {
        await lockBom(tx, parsed.sourceId);
        const source = await tx.billOfMaterials.findUnique({
          where: { id: parsed.sourceId },
          select: { finishedProductId: true, status: true },
        });
        if (!source || source.status === "DRAFT") {
          throw new BomActionError(
            "لا يمكن إنشاء مراجعة جديدة من مسودة قائمة المواد",
          );
        }
        if (source.finishedProductId !== finishedProductId) {
          throw new BomActionError(
            "يجب أن تحتفظ المراجعة الجديدة بالمنتج النهائي نفسه",
          );
        }
      }

      const componentSnapshots = await getValidatedComponentSnapshots(
        tx,
        finishedProductId,
        parsed.components,
      );
      const latestRevision = await tx.billOfMaterials.aggregate({
        where: { finishedProductId },
        _max: { revision: true },
      });
      const bom = await tx.billOfMaterials.create({
        data: {
          finishedProductId,
          revision: nextBomRevision(latestRevision._max.revision),
          components: {
            create: componentSnapshots.map((component) => ({
              materialProductId: component.materialProductId,
              quantityPerUnit: component.quantityPerUnit,
              materialName: component.materialName,
              materialSku: component.materialSku,
              unit: component.unit,
            })),
          },
        },
        select: { id: true },
      });
      return bom.id;
    });

    revalidatePath("/production/boms");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof BomActionError) {
      return { ok: false, error: error.message };
    }
    if (prismaErrorCode(error) === "P2002") {
      return {
        ok: false,
        error: "تم إنشاء مراجعة متزامنة لهذا المنتج، أعد المحاولة",
      };
    }
    console.error("Failed to create BOM", {
      code: prismaErrorCode(error),
    });
    return { ok: false, error: "تعذّر حفظ قائمة المواد، حاول مرة أخرى" };
  }
}

export async function updateBom(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requirePermission("production.bom.manage");
  const id = String(formData.get("bomId") ?? "").trim();
  if (!isRecordId(id)) return { ok: false, error: "قائمة المواد غير صالحة" };
  const parsed = parseBomForm(formData);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  if (parsed.sourceId) {
    return { ok: false, error: "لا يمكن تغيير مراجعة قائمة مواد موجودة" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockBom(tx, id);
      const existing = await tx.billOfMaterials.findUnique({
        where: { id },
        select: { id: true, finishedProductId: true, status: true },
      });
      if (!existing) throw new BomActionError("قائمة المواد غير موجودة");
      if (!canEditBom(existing.status)) {
        throw new BomActionError(
          "المراجعات المعتمدة أو المتقاعدة غير قابلة للتعديل",
        );
      }
      if (existing.finishedProductId !== parsed.finishedProductId) {
        throw new BomActionError(
          "لا يمكن تغيير المنتج النهائي بعد إنشاء المراجعة",
        );
      }

      const componentSnapshots = await getValidatedComponentSnapshots(
        tx,
        existing.finishedProductId,
        parsed.components,
      );
      await tx.billOfMaterialsComponent.deleteMany({ where: { bomId: id } });
      await tx.billOfMaterialsComponent.createMany({
        data: componentSnapshots.map((component) => ({
          bomId: id,
          materialProductId: component.materialProductId,
          quantityPerUnit: component.quantityPerUnit,
          materialName: component.materialName,
          materialSku: component.materialSku,
          unit: component.unit,
        })),
      });
    });

    revalidatePath(`/production/boms/${id}`);
    revalidatePath("/production/boms");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof BomActionError) {
      return { ok: false, error: error.message };
    }
    console.error("Failed to update BOM", {
      code: prismaErrorCode(error),
    });
    return { ok: false, error: "تعذّر تحديث قائمة المواد، حاول مرة أخرى" };
  }
}

export async function transitionBom(
  id: string,
  action: "release" | "retire",
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("production.bom.manage");
  if (!isRecordId(id)) return { ok: false, error: "قائمة المواد غير صالحة" };

  try {
    await prisma.$transaction(async (tx) => {
      await lockBom(tx, id);
      const existing = await tx.billOfMaterials.findUnique({
        where: { id },
        select: {
          id: true,
          finishedProductId: true,
          status: true,
          components: { select: { materialProductId: true } },
        },
      });
      if (!existing) throw new BomActionError("قائمة المواد غير موجودة");
      const nextStatus = getBomStatusTransition(existing.status, action);
      if (!nextStatus) {
        throw new BomActionError("تغيير حالة قائمة المواد غير مسموح");
      }

      const data: Prisma.BillOfMaterialsUpdateInput = {
        status: nextStatus,
        ...(nextStatus === "RELEASED"
          ? { releasedAt: new Date() }
          : { retiredAt: new Date() }),
      };

      if (nextStatus === "RELEASED") {
        if (existing.components.length === 0) {
          throw new BomActionError(
            "أضف مادة أولية واحدة على الأقل قبل اعتماد قائمة المواد",
          );
        }
        await lockProducts(tx, [
          existing.finishedProductId,
          ...existing.components.map(
            (component) => component.materialProductId,
          ),
        ]);
        const existingRelease = await tx.billOfMaterials.count({
          where: {
            finishedProductId: existing.finishedProductId,
            status: "RELEASED",
            id: { not: id },
          },
        });
        if (existingRelease > 0) {
          throw new BomActionError(
            "تقاعد المراجعة المعتمدة حاليًا قبل اعتماد هذه المراجعة",
          );
        }
        const products = await tx.product.findMany({
          where: {
            id: {
              in: [
                existing.finishedProductId,
                ...existing.components.map(
                  (component) => component.materialProductId,
                ),
              ],
            },
          },
          select: { id: true, classification: true },
        });
        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );
        const finishedProduct = productsById.get(existing.finishedProductId);
        if (
          !finishedProduct ||
          !classificationAllowsBomUse(
            finishedProduct.classification,
            "finished",
          )
        ) {
          throw new BomActionError(
            "تصنيف المنتج النهائي لا يسمح باعتماد قائمة المواد",
          );
        }
        if (
          existing.components.some((component) => {
            const material = productsById.get(component.materialProductId);
            return (
              !material ||
              !classificationAllowsBomUse(material.classification, "material")
            );
          })
        ) {
          throw new BomActionError(
            "يوجد مكوّن لا يسمح تصنيفه باعتماد قائمة المواد",
          );
        }
      }

      await tx.billOfMaterials.update({ where: { id }, data });
    });

    revalidatePath(`/production/boms/${id}`);
    revalidatePath("/production/boms");
    return { ok: true };
  } catch (error) {
    if (error instanceof BomActionError) {
      return { ok: false, error: error.message };
    }
    console.error("Failed to transition BOM", {
      code: prismaErrorCode(error),
    });
    return { ok: false, error: "تعذّر تغيير حالة قائمة المواد" };
  }
}

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

"use server";

import { prisma } from "@/lib/db";
import {
  createProductWithInitialStock,
  parseInventoryQuantity,
} from "@/lib/inventory-quantity";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import {
  assertUnreservedStockAvailable,
  lockInventoryProducts,
  SalesOrderError,
} from "@/lib/sales-order-operations";
import {
  classificationCompatibleWithBomReferences,
  isProductClassification,
} from "@/lib/production-bom";

export async function createProduct(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("product.create");

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const rawClassification = formData.get("classification");
  const classification =
    rawClassification === null ? "UNCLASSIFIED" : String(rawClassification);
  const quantity = parseInventoryQuantity(
    String(formData.get("quantity") ?? ""),
    true,
  );
  const minQuantity = parseInventoryQuantity(
    String(formData.get("minQuantity") ?? ""),
    true,
  );

  if (!name || !sku || !unit) {
    return { ok: false, error: "الاسم والرمز والوحدة حقول مطلوبة" };
  }
  if (!isProductClassification(classification)) {
    return { ok: false, error: "تصنيف المنتج غير صالح" };
  }
  if (quantity === null) {
    return { ok: false, error: "أدخل كمية ابتدائية صالحة ضمن النطاق المسموح" };
  }
  if (minQuantity === null) {
    return { ok: false, error: "أدخل حد تنبيه صالحًا ضمن النطاق المسموح" };
  }
  if (quantity > 0) await requirePermission("stock.move");

  try {
    await prisma.$transaction(async (tx) => {
      await createProductWithInitialStock(tx, {
        name,
        sku,
        unit,
        quantity,
        minQuantity,
        classification,
      });
    });

    revalidatePath("/");
    revalidatePath("/production");
    return { ok: true };
  } catch (e) {
    if (prismaErrorCode(e) === "P2002") {
      return { ok: false, error: "هذا الرمز (SKU) مستخدم لمنتج آخر" };
    }
    console.error("Failed to create product", { code: prismaErrorCode(e) });
    return { ok: false, error: "تعذّر إضافة المنتج، حاول مرة أخرى" };
  }
}
class MovementError extends Error {}

export async function recordMovement(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("stock.move");

  const productId = String(formData.get("productId") ?? "");
  const type = String(formData.get("type") ?? "");
  const quantity = parseInventoryQuantity(
    String(formData.get("quantity") ?? ""),
    false,
  );
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!productId) return { ok: false, error: "اختر المنتج" };
  if (type !== "IN" && type !== "OUT") return { ok: false, error: "نوع الحركة غير صالح" };
  if (quantity === null) {
    return {
      ok: false,
      error: "أدخل كمية أكبر من صفر ضمن النطاق والدقة المسموحين",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockInventoryProducts(tx, [productId]);
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true },
      });
      if (!product) throw new MovementError("المنتج غير موجود");
      if (type === "OUT") {
        await assertUnreservedStockAvailable(tx, [
          { productId, productName: product.name, quantity },
        ]);
      }

      const result =
        type === "OUT"
          ? await tx.product.updateMany({
              where: { id: productId, quantity: { gte: quantity } },
              data: { quantity: { decrement: quantity } },
            })
          : await tx.product.updateMany({
              where: { id: productId },
              data: { quantity: { increment: quantity } },
            });

      if (result.count === 0) {
        if (type === "OUT") {
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true },
          });
          if (product) {
            throw new MovementError("الكمية المطلوبة أكبر من المخزون المتاح");
          }
        }
        throw new MovementError("المنتج غير موجود");
      }

      await tx.stockMovement.create({
        data: { productId, type, quantity, reason, reference },
      });
    });

    revalidatePath("/");
    revalidatePath("/production");
    return { ok: true };
  } catch (e) {
    if (e instanceof MovementError) return { ok: false, error: e.message };
    if (e instanceof SalesOrderError) return { ok: false, error: e.message };
    return { ok: false, error: "تعذر حفظ الحركة، حاول مرة أخرى" };
  }
}
function prismaErrorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export async function updateProduct(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("product.update");

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const rawClassification = formData.get("classification");
  const classification =
    rawClassification === null ? null : String(rawClassification);
  const minQuantity = parseInventoryQuantity(
    String(formData.get("minQuantity") ?? ""),
    true,
  );

  if (!id) return { ok: false, error: "المنتج غير محدد" };
  if (!name || !sku || !unit) {
    return { ok: false, error: "الاسم والرمز والوحدة حقول مطلوبة" };
  }
  if (classification !== null && !isProductClassification(classification)) {
    return { ok: false, error: "تصنيف المنتج غير صالح" };
  }
  if (minQuantity === null) {
    return {
      ok: false,
      error: "أدخل حد تنبيه صالحًا ضمن النطاق المسموح",
    };
  }

  try {
    const productWithSku = await prisma.product.findFirst({
      where: { sku, id: { not: id } },
      select: { id: true },
    });
    if (productWithSku) {
      return { ok: false, error: "هذا الرمز (SKU) مستخدم لمنتج آخر" };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE
      `;
      const current = await tx.product.findUnique({
        where: { id },
        select: { classification: true },
      });
      if (!current) return { ok: false as const, error: "المنتج غير موجود أو تم حذفه" };

      const nextClassification = classification ?? current.classification;
      const [finishedProductReferences, materialReferences] =
        await Promise.all([
          tx.billOfMaterials.count({ where: { finishedProductId: id } }),
          tx.billOfMaterialsComponent.count({
            where: { materialProductId: id },
          }),
        ]);
      if (
        !classificationCompatibleWithBomReferences(
          nextClassification,
          finishedProductReferences,
          materialReferences,
        )
      ) {
        return {
          ok: false as const,
          error: "لا يمكن تغيير التصنيف ما دام المنتج مستخدمًا بهذا الدور في قوائم المواد",
        };
      }

      await tx.product.update({
        where: { id },
        data: {
          name,
          sku,
          unit,
          minQuantity,
          classification: nextClassification,
        },
      });
      return { ok: true as const };
    });
    if (!result.ok) return result;
    revalidatePath("/");
    revalidatePath("/production/boms");
    revalidatePath("/production");
    return { ok: true };
  } catch (e) {
    const errorCode = prismaErrorCode(e);
    if (errorCode === "P2002") {
      return { ok: false, error: "هذا الرمز (SKU) مستخدم لمنتج آخر" };
    }
    if (errorCode === "P2025") {
      return { ok: false, error: "المنتج غير موجود أو تم حذفه" };
    }
    console.error("Failed to update product", { code: prismaErrorCode(e) });
    return { ok: false, error: "تعذّر حفظ التعديلات، حاول مرة أخرى" };
  }
}

export async function deleteProduct(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("product.delete");

  if (!id) return { ok: false, error: "المنتج غير محدد" };

  try {
    const [
      movements,
      purchaseOrderLines,
      finishedBoms,
      materialBomComponents,
    ] = await Promise.all([
      prisma.stockMovement.count({ where: { productId: id } }),
      prisma.purchaseOrderLine.count({ where: { productId: id } }),
      prisma.billOfMaterials.count({ where: { finishedProductId: id } }),
      prisma.billOfMaterialsComponent.count({
        where: { materialProductId: id },
      }),
    ]);
    if (
      movements > 0 ||
      purchaseOrderLines > 0 ||
      finishedBoms > 0 ||
      materialBomComponents > 0
    ) {
      return {
        ok: false,
        error: "لا يمكن حذف منتج مرتبط بحركات مخزون أو أوامر شراء أو قوائم مواد",
      };
    }
    await prisma.product.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/production");
    return { ok: true };
  } catch (e) {
    if (prismaErrorCode(e) === "P2003") {
      return {
        ok: false,
        error: "لا يمكن حذف منتج مرتبط بحركات مخزون أو أوامر شراء أو قوائم مواد",
      };
    }
    return { ok: false, error: "تعذّر حذف المنتج، حاول مرة أخرى" };
  }

}

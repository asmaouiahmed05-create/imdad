"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createProduct(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const quantity = parseFloat(String(formData.get("quantity") ?? "")) || 0;
  const minQuantity = parseFloat(String(formData.get("minQuantity") ?? "")) || 0;

  if (!name || !sku || !unit) {
    return { ok: false, error: "الاسم والرمز والوحدة حقول مطلوبة" };
  }

  try {
    await prisma.product.create({
      data: { name, sku, unit, quantity, minQuantity },
    });

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    if (prismaErrorCode(e) === "P2002") {
      return { ok: false, error: "هذا الرمز (SKU) مستخدم لمنتج آخر" };
    }
    console.error("Failed to create product", e);
    return { ok: false, error: "تعذّر إضافة المنتج، حاول مرة أخرى" };
  }
}
class MovementError extends Error {}

export async function recordMovement(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const productId = String(formData.get("productId") ?? "");
  const type = String(formData.get("type") ?? "");
  const quantity = parseFloat(String(formData.get("quantity") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!productId) return { ok: false, error: "اختر المنتج" };
  if (type !== "IN" && type !== "OUT") return { ok: false, error: "نوع الحركة غير صالح" };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "أدخل كمية أكبر من صفر" };
  }

  try {
    await prisma.$transaction(async (tx) => {
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
    return { ok: true };
  } catch (e) {
    if (e instanceof MovementError) return { ok: false, error: e.message };
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
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const minQuantityValue = String(formData.get("minQuantity") ?? "").trim();
  const minQuantity =
    minQuantityValue === "" ? undefined : Number(minQuantityValue);

  if (!id) return { ok: false, error: "المنتج غير محدد" };
  if (!name || !sku || !unit) {
    return { ok: false, error: "الاسم والرمز والوحدة حقول مطلوبة" };
  }
  if (minQuantity !== undefined && (!Number.isFinite(minQuantity) || minQuantity < 0)) {
    return { ok: false, error: "حد التنبيه يجب أن يكون صفرًا أو أكثر" };
  }

  try {
    const productWithSku = await prisma.product.findFirst({
      where: { sku, id: { not: id } },
      select: { id: true },
    });
    if (productWithSku) {
      return { ok: false, error: "هذا الرمز (SKU) مستخدم لمنتج آخر" };
    }

    await prisma.product.update({
      where: { id },
      data: {
        name,
        sku,
        unit,
        ...(minQuantity !== undefined ? { minQuantity } : {}),
      },
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const errorCode = prismaErrorCode(e);
    if (errorCode === "P2002") {
      return { ok: false, error: "هذا الرمز (SKU) مستخدم لمنتج آخر" };
    }
    if (errorCode === "P2025") {
      return { ok: false, error: "المنتج غير موجود أو تم حذفه" };
    }
    console.error("Failed to update product", e);
    return { ok: false, error: "تعذّر حفظ التعديلات، حاول مرة أخرى" };
  }
}

export async function deleteProduct(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "المنتج غير محدد" };

  try {
    const [movements, purchaseOrderLines] = await Promise.all([
      prisma.stockMovement.count({ where: { productId: id } }),
      prisma.purchaseOrderLine.count({ where: { productId: id } }),
    ]);
    if (movements > 0 || purchaseOrderLines > 0) {
      return {
        ok: false,
        error: "لا يمكن حذف منتج مرتبط بحركات مخزون أو أوامر شراء مسجّلة",
      };
    }
    await prisma.product.delete({ where: { id } });
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    if (prismaErrorCode(e) === "P2003") {
      return {
        ok: false,
        error: "لا يمكن حذف منتج مرتبط بحركات مخزون أو أوامر شراء مسجّلة",
      };
    }
    return { ok: false, error: "تعذّر حذف المنتج، حاول مرة أخرى" };
  }

}

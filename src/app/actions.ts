"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createProduct(formData: FormData) {
  const name = formData.get("name") as string;
  const sku = formData.get("sku") as string;
  const unit = formData.get("unit") as string;
  const quantity = parseFloat(formData.get("quantity") as string) || 0;
  const minQuantity = parseFloat(formData.get("minQuantity") as string) || 0;

  if (!name || !sku || !unit) {
    throw new Error("الاسم والرمز والوحدة حقول مطلوبة");
  }

  await prisma.product.create({
    data: { name, sku, unit, quantity, minQuantity },
  });

  revalidatePath("/");
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
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

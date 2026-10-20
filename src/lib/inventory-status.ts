import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type InventoryStatus = "all" | "normal" | "low" | "out";

export function inventoryStatusWhere(
  status: InventoryStatus,
): Prisma.ProductWhereInput {
  switch (status) {
    case "normal":
      return {
        quantity: { not: 0, gt: prisma.product.fields.minQuantity },
      };
    case "low":
      return {
        AND: [
          { quantity: { not: 0 } },
          { quantity: { lte: prisma.product.fields.minQuantity } },
        ],
      };
    case "out":
      return { quantity: 0 };
    case "all":
      return {};
  }
}

export function inventoryStatus(quantity: number, minQuantity: number) {
  if (quantity === 0) return "out" as const;
  if (quantity <= minQuantity) return "low" as const;
  return "normal" as const;
}

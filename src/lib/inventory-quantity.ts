import type { Prisma } from "@prisma/client";

export const MAX_INVENTORY_QUANTITY = 1_000_000_000;
export const MAX_INVENTORY_DECIMAL_PLACES = 6;

export function parseInventoryQuantity(value: string, allowZero: boolean) {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 32 ||
    !/^(?:\d+(?:\.\d+)?|\.\d+)$/u.test(normalized)
  ) {
    return null;
  }

  const decimalPoint = normalized.indexOf(".");
  if (
    decimalPoint !== -1 &&
    normalized.length - decimalPoint - 1 > MAX_INVENTORY_DECIMAL_PLACES
  ) {
    return null;
  }

  const quantity = Number(normalized);
  if (
    !Number.isFinite(quantity) ||
    quantity > MAX_INVENTORY_QUANTITY ||
    (allowZero ? quantity < 0 : quantity <= 0)
  ) {
    return null;
  }

  return quantity;
}

type InitialStockTransaction = Pick<
  Prisma.TransactionClient,
  "product" | "stockMovement"
>;

type ProductWithInitialStock = {
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  minQuantity: number;
};

export async function createProductWithInitialStock(
  tx: InitialStockTransaction,
  data: ProductWithInitialStock,
) {
  const product = await tx.product.create({
    data,
    select: { id: true },
  });

  if (data.quantity > 0) {
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: "IN",
        quantity: data.quantity,
        reason: "رصيد افتتاحي",
        reference: null,
      },
    });
  }

  return product;
}

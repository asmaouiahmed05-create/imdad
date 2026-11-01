import type { Product } from "@prisma/client";

export type WarehouseProduct = Pick<
  Product,
  | "id"
  | "name"
  | "sku"
  | "unit"
  | "quantity"
  | "minQuantity"
  | "classification"
>;

export type StockStatusDatum = {
  name: string;
  value: number;
  color: string;
};

export type TopProductDatum = {
  name: string;
  sku: string;
  quantity: number;
};

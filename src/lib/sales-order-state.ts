import { parseInventoryQuantity } from "./inventory-quantity.ts";

export const CUSTOMER_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
] as const;

export type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];
export type CustomerOrderLineInput = {
  productId: string;
  quantity: number;
};

export const CUSTOMER_ORDER_STATUS_LABELS: Record<
  CustomerOrderStatus,
  string
> = {
  DRAFT: "مسودة",
  CONFIRMED: "مؤكد ومحجوز",
  FULFILLED: "مكتمل",
  CANCELLED: "ملغى",
};

export const CUSTOMER_ORDER_STATUS_CLASSES: Record<
  CustomerOrderStatus,
  string
> = {
  DRAFT: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  CONFIRMED: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  FULFILLED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  CANCELLED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

export const MAX_CUSTOMER_ORDER_LINES = 100;

export function isCustomerOrderStatus(
  value: unknown,
): value is CustomerOrderStatus {
  return (
    typeof value === "string" &&
    (CUSTOMER_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export function parseCustomerOrderQuantity(value: string) {
  return parseInventoryQuantity(value, false);
}

export function parseCustomerOrderLines(
  productIds: readonly string[],
  quantities: readonly string[],
):
  | { ok: true; lines: CustomerOrderLineInput[] }
  | { ok: false; error: string } {
  if (
    productIds.length !== quantities.length ||
    productIds.length > MAX_CUSTOMER_ORDER_LINES
  ) {
    return { ok: false, error: "تحقق من أصناف وكميات الطلب." };
  }

  const lines: CustomerOrderLineInput[] = [];
  const seenProducts = new Set<string>();
  for (let index = 0; index < productIds.length; index += 1) {
    const productId = productIds[index].trim();
    const rawQuantity = quantities[index].trim();
    if (!productId && !rawQuantity) continue;
    if (!productId) {
      return { ok: false, error: "اختر صنفًا لكل كمية مدخلة." };
    }
    const quantity = parseCustomerOrderQuantity(rawQuantity);
    if (quantity === null) {
      return {
        ok: false,
        error: "أدخل كمية موجبة صالحة لا تتجاوز مليارًا وبحد أقصى 6 منازل عشرية.",
      };
    }
    if (seenProducts.has(productId)) {
      return { ok: false, error: "لا تكرر الصنف نفسه في طلب العميل." };
    }
    seenProducts.add(productId);
    lines.push({ productId, quantity });
  }

  if (lines.length === 0) {
    return { ok: false, error: "أضف صنفًا واحدًا على الأقل إلى الطلب." };
  }
  return { ok: true, lines };
}

export function parseCustomerOrderDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

export function canTransitionCustomerOrder(
  current: CustomerOrderStatus,
  next: CustomerOrderStatus,
) {
  return (
    (current === "DRAFT" &&
      (next === "CONFIRMED" || next === "CANCELLED")) ||
    (current === "CONFIRMED" &&
      (next === "FULFILLED" || next === "CANCELLED"))
  );
}

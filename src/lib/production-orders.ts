import { parseInventoryQuantity } from "./inventory-quantity.ts";

export const PRODUCTION_ORDER_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ProductionOrderStatusValue =
  (typeof PRODUCTION_ORDER_STATUSES)[number];

export function isProductionOrderStatus(
  value: unknown,
): value is ProductionOrderStatusValue {
  return (
    typeof value === "string" &&
    (PRODUCTION_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export const PRODUCTION_ORDER_STATUS_LABELS: Record<
  ProductionOrderStatusValue,
  string
> = {
  DRAFT: "مسودة",
  IN_PROGRESS: "قيد الإنتاج",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

export const PRODUCTION_ORDER_STATUS_CLASSES: Record<
  ProductionOrderStatusValue,
  string
> = {
  DRAFT: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  IN_PROGRESS: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  COMPLETED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  CANCELLED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

const QUANTITY_SCALE = BigInt(1_000_000);
const MAX_SCALED_QUANTITY = BigInt(1_000_000_000) * QUANTITY_SCALE;

export type ProductionComponentInput = {
  materialProductId: string;
  quantityPerUnit: string;
  materialName: string;
  materialSku: string;
  unit: string;
};

export type MaterialRequirement = ProductionComponentInput & {
  requiredQuantity: number;
};

function scaledQuantity(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,6}))?$|^\.(\d{1,6})$/u.exec(
    normalized,
  );
  if (!match) return null;
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? match[3] ?? "").padEnd(6, "0");
  const scaled = BigInt(whole) * QUANTITY_SCALE + BigInt(fraction || "0");
  return scaled <= MAX_SCALED_QUANTITY ? scaled : null;
}

export function parseProductionOrderQuantity(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return parseInventoryQuantity(String(value), false);
}

export function calculateMaterialRequirements(
  components: readonly ProductionComponentInput[],
  productionQuantity: unknown,
  finishedProductId?: string,
):
  | { ok: true; requirements: MaterialRequirement[] }
  | { ok: false; error: string } {
  const productionQuantityScaled = scaledQuantity(productionQuantity);
  if (!productionQuantityScaled || productionQuantityScaled <= BigInt(0)) {
    return { ok: false, error: "كمية الإنتاج غير صالحة" };
  }
  if (components.length === 0 || components.length > 100) {
    return { ok: false, error: "يجب أن يحتوي أمر الإنتاج على مواد صالحة" };
  }

  const seen = new Set<string>();
  const requirements: MaterialRequirement[] = [];
  for (const component of components) {
    if (
      !component.materialProductId ||
      component.materialProductId === finishedProductId ||
      seen.has(component.materialProductId)
    ) {
      return { ok: false, error: "مكونات قائمة المواد غير صالحة أو مكررة" };
    }

    const perUnitScaled = scaledQuantity(component.quantityPerUnit);
    if (!perUnitScaled || perUnitScaled <= BigInt(0)) {
      return { ok: false, error: "كمية أحد مكونات قائمة المواد غير صالحة" };
    }

    const requiredScaled =
      (perUnitScaled * productionQuantityScaled + QUANTITY_SCALE - BigInt(1)) /
      QUANTITY_SCALE;
    if (
      requiredScaled <= BigInt(0) ||
      requiredScaled > MAX_SCALED_QUANTITY
    ) {
      return { ok: false, error: "كمية أحد المكونات تتجاوز الحد المسموح" };
    }

    seen.add(component.materialProductId);
    requirements.push({
      ...component,
      requiredQuantity: Number(requiredScaled) / Number(QUANTITY_SCALE),
    });
  }
  return { ok: true, requirements };
}

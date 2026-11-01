import { parseInventoryQuantity } from "./inventory-quantity.ts";

export const PRODUCT_CLASSIFICATIONS = [
  "UNCLASSIFIED",
  "MATERIAL",
  "FINISHED_GOOD",
  "BOTH",
] as const;

export type ProductClassificationValue =
  (typeof PRODUCT_CLASSIFICATIONS)[number];

export const PRODUCT_CLASSIFICATION_LABELS: Record<
  ProductClassificationValue,
  string
> = {
  UNCLASSIFIED: "غير مصنف",
  MATERIAL: "مادة أولية",
  FINISHED_GOOD: "منتج نهائي",
  BOTH: "مادة أولية ومنتج نهائي",
};

export const BOM_STATUS_LABELS = {
  DRAFT: "مسودة",
  RELEASED: "معتمد",
  RETIRED: "متقاعد",
} as const;

export type BomStatus = keyof typeof BOM_STATUS_LABELS;
export type BomComponentInput = {
  materialProductId: unknown;
  quantityPerUnit: unknown;
};
const MAX_BOM_REVISION = 2_147_483_647;

export type ValidBomComponentInput = {
  materialProductId: string;
  quantityPerUnit: number;
};

export function isProductClassification(
  value: unknown,
): value is ProductClassificationValue {
  return (
    typeof value === "string" &&
    (PRODUCT_CLASSIFICATIONS as readonly string[]).includes(value)
  );
}

export function isRecordId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/u.test(value.trim())
  );
}

export function classificationAllowsBomUse(
  classification: ProductClassificationValue,
  use: "material" | "finished",
) {
  return (
    classification === "BOTH" ||
    (use === "material" && classification === "MATERIAL") ||
    (use === "finished" && classification === "FINISHED_GOOD")
  );
}

export function classificationCompatibleWithBomReferences(
  classification: ProductClassificationValue,
  finishedProductReferences: number,
  materialReferences: number,
) {
  return (
    (finishedProductReferences === 0 ||
      classificationAllowsBomUse(classification, "finished")) &&
    (materialReferences === 0 ||
      classificationAllowsBomUse(classification, "material"))
  );
}

export function validateBomComponents(
  rows: readonly BomComponentInput[],
  finishedProductId: string,
):
  | { ok: true; components: ValidBomComponentInput[] }
  | { ok: false; error: string } {
  if (!isRecordId(finishedProductId)) {
    return { ok: false, error: "المنتج النهائي غير صالح" };
  }
  if (rows.length === 0 || rows.length > 100) {
    return {
      ok: false,
      error: "يجب إضافة مادة أولية واحدة على الأقل، وبحد أقصى 100 مادة",
    };
  }

  const components: ValidBomComponentInput[] = [];
  const materialIds = new Set<string>();

  for (const row of rows) {
    const materialProductId =
      typeof row.materialProductId === "string"
        ? row.materialProductId.trim()
        : "";
    const quantityPerUnit = parseInventoryQuantity(
      typeof row.quantityPerUnit === "string" ||
        typeof row.quantityPerUnit === "number"
        ? String(row.quantityPerUnit)
        : "",
      false,
    );

    if (!isRecordId(materialProductId)) {
      return { ok: false, error: "اختر مادة أولية صالحة لكل مكوّن" };
    }
    if (materialProductId === finishedProductId) {
      return {
        ok: false,
        error: "لا يمكن استخدام المنتج النهائي كمادة أولية لنفسه",
      };
    }
    if (materialIds.has(materialProductId)) {
      return {
        ok: false,
        error: "لا يمكن تكرار المادة الأولية في قائمة المكونات",
      };
    }
    if (quantityPerUnit === null) {
      return {
        ok: false,
        error: "أدخل كمية موجبة صالحة لكل وحدة من المنتج النهائي",
      };
    }

    materialIds.add(materialProductId);
    components.push({ materialProductId, quantityPerUnit });
  }

  return { ok: true, components };
}

export function canEditBom(status: unknown): status is "DRAFT" {
  return status === "DRAFT";
}

export function getBomStatusTransition(
  status: unknown,
  action: unknown,
): BomStatus | null {
  if (status === "DRAFT" && action === "release") return "RELEASED";
  if (status === "RELEASED" && action === "retire") return "RETIRED";
  return null;
}

export function nextBomRevision(maxRevision: number | null) {
  if (
    maxRevision !== null &&
    (!Number.isSafeInteger(maxRevision) ||
      maxRevision < 1 ||
      maxRevision >= MAX_BOM_REVISION)
  ) {
    throw new RangeError("Invalid maximum BOM revision");
  }
  return (maxRevision ?? 0) + 1;
}

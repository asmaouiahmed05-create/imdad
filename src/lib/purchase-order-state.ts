import { parseInventoryQuantity } from "./inventory-quantity.ts";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type ReceiptLine = {
  orderedQuantity: number;
  receivedQuantity: number;
};

export function parsePositiveQuantity(value: string) {
  return parseInventoryQuantity(value, false);
}

export function calculateReceipt(line: ReceiptLine, requestedQuantity: number) {
  if (
    !Number.isFinite(line.orderedQuantity) ||
    !Number.isFinite(line.receivedQuantity) ||
    !Number.isFinite(requestedQuantity) ||
    line.orderedQuantity <= 0 ||
    line.receivedQuantity < 0 ||
    line.receivedQuantity > line.orderedQuantity ||
    requestedQuantity <= 0
  ) {
    return null;
  }

  const remaining = line.orderedQuantity - line.receivedQuantity;
  const tolerance =
    Number.EPSILON *
    Math.max(
      1,
      Math.abs(line.orderedQuantity),
      Math.abs(line.receivedQuantity),
      Math.abs(requestedQuantity),
    ) *
    4;
  if (requestedQuantity > remaining + tolerance) return null;

  const acceptedQuantity = Math.min(requestedQuantity, remaining);
  const closesLine = requestedQuantity >= remaining - tolerance;
  return {
    quantity: closesLine ? remaining : acceptedQuantity,
    receivedQuantity: closesLine
      ? line.orderedQuantity
      : line.receivedQuantity + acceptedQuantity,
  };
}

export function derivePurchaseOrderStatus(
  lines: readonly ReceiptLine[],
): PurchaseOrderStatus {
  if (lines.length === 0) return "DRAFT";
  if (lines.every((line) => line.receivedQuantity >= line.orderedQuantity)) {
    return "RECEIVED";
  }
  if (lines.some((line) => line.receivedQuantity > 0)) {
    return "PARTIALLY_RECEIVED";
  }
  return "SUBMITTED";
}

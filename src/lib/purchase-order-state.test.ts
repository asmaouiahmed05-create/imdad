import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateReceipt,
  derivePurchaseOrderStatus,
  parsePositiveQuantity,
} from "./purchase-order-state.ts";

test("order status follows ordered and received quantities", () => {
  assert.equal(derivePurchaseOrderStatus([]), "DRAFT");
  assert.equal(
    derivePurchaseOrderStatus([
      { orderedQuantity: 3, receivedQuantity: 0 },
    ]),
    "SUBMITTED",
  );
  assert.equal(
    derivePurchaseOrderStatus([
      { orderedQuantity: 3, receivedQuantity: 1 },
    ]),
    "PARTIALLY_RECEIVED",
  );
  assert.equal(
    derivePurchaseOrderStatus([
      { orderedQuantity: 3, receivedQuantity: 3 },
      { orderedQuantity: 2, receivedQuantity: 2 },
    ]),
    "RECEIVED",
  );
  assert.equal(
    derivePurchaseOrderStatus([
      { orderedQuantity: 3, receivedQuantity: 3 },
      { orderedQuantity: 2, receivedQuantity: 1 },
    ]),
    "PARTIALLY_RECEIVED",
  );
});

test("receipt accepts partial quantities and closes the exact remainder", () => {
  assert.deepEqual(
    calculateReceipt({ orderedQuantity: 5, receivedQuantity: 0 }, 2),
    { quantity: 2, receivedQuantity: 2 },
  );
  const finalFractionalReceipt = calculateReceipt(
    { orderedQuantity: 0.3, receivedQuantity: 0.2 },
    0.1,
  );
  assert.ok(finalFractionalReceipt);
  assert.ok(Math.abs(finalFractionalReceipt.quantity - 0.1) < 1e-12);
  assert.equal(finalFractionalReceipt.receivedQuantity, 0.3);
});

test("receipt rejects non-positive, invalid, and over-receipt quantities", () => {
  assert.equal(
    calculateReceipt({ orderedQuantity: 5, receivedQuantity: 0 }, 0),
    null,
  );
  assert.equal(
    calculateReceipt({ orderedQuantity: 5, receivedQuantity: 1 }, 4.01),
    null,
  );
  assert.equal(parsePositiveQuantity("NaN"), null);
  assert.equal(parsePositiveQuantity("-1"), null);
  assert.equal(parsePositiveQuantity("0"), null);
  assert.equal(parsePositiveQuantity("Infinity"), null);
  assert.equal(parsePositiveQuantity("1.25"), 1.25);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductionOrder,
  getInitialDemoOrders,
  getNextProductionStatus,
  parseProductionQuantity,
  validateProductionOrder,
} from "./production-demo.ts";

const validInput = {
  product: "كرسي مكتبي",
  quantity: 12.5,
  plannedStartDate: "2026-11-01",
  expectedCompletionDate: "2026-11-08",
  notes: "عرض توضيحي",
};

test("quantity parser accepts positive values with at most six decimals", () => {
  assert.equal(parseProductionQuantity("12.5"), 12.5);
  assert.equal(parseProductionQuantity(".000001"), 0.000001);
  assert.equal(parseProductionQuantity("1000000000"), 1_000_000_000);
});

test("quantity parser rejects invalid, non-positive, excessive precision, and out-of-range values", () => {
  for (const value of ["", "0", "-1", "1.1234567", "1000000001", "2items"]) {
    assert.equal(parseProductionQuantity(value), null, value);
  }
});

test("production order validation checks product, dates, and notes", () => {
  assert.equal(validateProductionOrder(validInput), null);
  assert.match(
    validateProductionOrder({ ...validInput, product: "منتج غير معروف" }) ?? "",
    /اختر منتجًا/u,
  );
  assert.match(
    validateProductionOrder({
      ...validInput,
      plannedStartDate: "2026-02-30",
    }) ?? "",
    /تاريخ بدء/u,
  );
  assert.match(
    validateProductionOrder({
      ...validInput,
      expectedCompletionDate: "2026-10-31",
    }) ?? "",
    /ألا يسبق/u,
  );
  assert.match(
    validateProductionOrder({ ...validInput, notes: "ن".repeat(2001) }) ?? "",
    /2000/u,
  );
});

test("created demo orders get a generated number, draft status, and timestamp", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  const order = createProductionOrder(
    validInput,
    getInitialDemoOrders(),
    now,
    "test-id",
  );
  assert.equal(order.id, "test-id");
  assert.equal(order.number, "PRD-2026-005");
  assert.equal(order.status, "DRAFT");
  assert.equal(order.createdAt, now.toISOString());
  assert.equal(order.quantity, validInput.quantity);
});

test("production order numbering starts over for a new year", () => {
  const order = createProductionOrder(
    validInput,
    getInitialDemoOrders(),
    new Date("2027-01-02T12:00:00.000Z"),
    "next-year-id",
  );
  assert.equal(order.number, "PRD-2027-001");
});

test("demo statuses advance one step and stop when completed", () => {
  assert.equal(getNextProductionStatus("DRAFT"), "PLANNED");
  assert.equal(getNextProductionStatus("PLANNED"), "IN_PROGRESS");
  assert.equal(getNextProductionStatus("IN_PROGRESS"), "COMPLETED");
  assert.equal(getNextProductionStatus("COMPLETED"), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionSalesStatus,
  createSalesOrder,
  getInitialSalesOrders,
  getNextSalesStatus,
  parseSalesQuantity,
  validateSalesOrder,
} from "./sales-demo.ts";

const validInput = {
  customerId: "customer-alger-centre",
  product: "كرسي مكتبي",
  quantity: 12,
  orderDate: "2026-11-01",
  expectedDeliveryDate: "2026-11-08",
  notes: "طلب تجريبي",
};

test("sales quantity parser accepts positive whole quantities only", () => {
  assert.equal(parseSalesQuantity("12"), 12);
  assert.equal(parseSalesQuantity("1000000"), 1_000_000);
  for (const value of ["", "0", "-1", "1.5", "1000001", "2items"]) {
    assert.equal(parseSalesQuantity(value), null, value);
  }
});

test("sales order validation checks customer, product, dates, and notes", () => {
  assert.equal(validateSalesOrder(validInput), null);
  assert.match(
    validateSalesOrder({ ...validInput, customerId: "unknown" }) ?? "",
    /اختر عميلًا/u,
  );
  assert.match(
    validateSalesOrder({ ...validInput, product: "منتج غير معروف" }) ?? "",
    /اختر منتجًا/u,
  );
  assert.match(
    validateSalesOrder({ ...validInput, orderDate: "2026-02-30" }) ?? "",
    /تاريخ طلب/u,
  );
  assert.match(
    validateSalesOrder({ ...validInput, expectedDeliveryDate: "2026-10-31" }) ??
      "",
    /ألا يسبق/u,
  );
  assert.match(
    validateSalesOrder({ ...validInput, notes: "ن".repeat(2001) }) ?? "",
    /2000/u,
  );
});

test("created order gets a generated order number and new status", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  const order = createSalesOrder(
    validInput,
    getInitialSalesOrders(),
    now,
    "test-id",
  );
  assert.equal(order.id, "test-id");
  assert.equal(order.number, "ORD-2026-007");
  assert.equal(order.status, "NEW");
  assert.equal(order.createdAt, now.toISOString());
});

test("sales statuses move forward and allow cancellation before delivery", () => {
  assert.equal(getNextSalesStatus("NEW"), "CONFIRMED");
  assert.equal(getNextSalesStatus("CONFIRMED"), "PREPARING");
  assert.equal(getNextSalesStatus("PREPARING"), "READY");
  assert.equal(getNextSalesStatus("READY"), "DELIVERED");
  assert.equal(getNextSalesStatus("DELIVERED"), null);
  assert.equal(canTransitionSalesStatus("PREPARING", "CANCELLED"), true);
  assert.equal(canTransitionSalesStatus("DELIVERED", "CANCELLED"), false);
  assert.equal(canTransitionSalesStatus("NEW", "READY"), false);
});

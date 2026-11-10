import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionCustomerOrder,
  parseCustomerOrderDate,
  parseCustomerOrderLines,
  parseCustomerOrderQuantity,
} from "./sales-order-state.ts";

test("customer order quantities accept bounded positive inventory precision", () => {
  assert.equal(parseCustomerOrderQuantity("12"), 12);
  assert.equal(parseCustomerOrderQuantity("0.000001"), 0.000001);
  assert.equal(parseCustomerOrderQuantity("1000000000"), 1_000_000_000);
  for (const value of ["", "0", "-1", "1.0000001", "1000000001", "2items"]) {
    assert.equal(parseCustomerOrderQuantity(value), null, value);
  }
});

test("order lines reject missing, duplicate, malformed, and excessive items", () => {
  assert.deepEqual(
    parseCustomerOrderLines(["product-1"], ["2.5"]),
    { ok: true, lines: [{ productId: "product-1", quantity: 2.5 }] },
  );
  assert.equal(parseCustomerOrderLines([], []).ok, false);
  assert.equal(parseCustomerOrderLines([""], ["2"]).ok, false);
  assert.equal(
    parseCustomerOrderLines(["product-1", "product-1"], ["1", "2"]).ok,
    false,
  );
  assert.equal(parseCustomerOrderLines(["product-1"], ["0"]).ok, false);
  assert.equal(
    parseCustomerOrderLines(
      Array.from({ length: 101 }, (_, index) => `product-${index}`),
      Array.from({ length: 101 }, () => "1"),
    ).ok,
    false,
  );
});

test("expected fulfillment date parser rejects impossible dates", () => {
  assert.equal(parseCustomerOrderDate(""), null);
  assert.equal(
    parseCustomerOrderDate("2026-02-28")?.toISOString(),
    "2026-02-28T00:00:00.000Z",
  );
  assert.equal(parseCustomerOrderDate("2026-02-30"), undefined);
  assert.equal(parseCustomerOrderDate("2026-2-3"), undefined);
});

test("customer order lifecycle only permits approved transitions", () => {
  assert.equal(canTransitionCustomerOrder("DRAFT", "CONFIRMED"), true);
  assert.equal(canTransitionCustomerOrder("DRAFT", "CANCELLED"), true);
  assert.equal(canTransitionCustomerOrder("CONFIRMED", "FULFILLED"), true);
  assert.equal(canTransitionCustomerOrder("CONFIRMED", "CANCELLED"), true);
  assert.equal(canTransitionCustomerOrder("FULFILLED", "CANCELLED"), false);
  assert.equal(canTransitionCustomerOrder("CANCELLED", "CONFIRMED"), false);
  assert.equal(canTransitionCustomerOrder("DRAFT", "FULFILLED"), false);
});

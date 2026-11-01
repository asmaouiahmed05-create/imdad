import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateDelivery,
  canTransitionDeliveryStatus,
  createDelivery,
  getInitialDemoDeliveries,
  getNextDeliveryStatus,
  validateDelivery,
} from "./delivery-demo.ts";
import { getInitialSalesOrders } from "./sales-demo.ts";

const orders = getInitialSalesOrders();
const validInput = {
  orderId: "demo-sales-004",
  address: "شارع أول نوفمبر، وسط المدينة، سطيف",
  deliveryDate: "2026-11-12",
  driverId: "driver-karim",
  notes: "الاتصال قبل الوصول",
};

test("delivery eligibility is limited to confirmed and ready customer orders", () => {
  assert.equal(canCreateDelivery(orders[1]), true);
  assert.equal(canCreateDelivery(orders[3]), true);
  assert.equal(canCreateDelivery(orders[0]), false);
  assert.equal(canCreateDelivery(orders[2]), false);
});

test("delivery validation requires an eligible order, address, date, and driver", () => {
  assert.equal(validateDelivery(validInput, orders, []), null);
  assert.match(
    validateDelivery({ ...validInput, orderId: "missing" }, orders, []) ?? "",
    /موجودًا/u,
  );
  assert.match(
    validateDelivery({ ...validInput, orderId: orders[0].id }, orders, []) ?? "",
    /المؤكدة أو الجاهزة/u,
  );
  assert.match(
    validateDelivery({ ...validInput, address: " " }, orders, []) ?? "",
    /عنوان التسليم/u,
  );
  assert.match(
    validateDelivery({ ...validInput, deliveryDate: "2026-02-30" }, orders, []) ??
      "",
    /تاريخ تسليم/u,
  );
  assert.match(
    validateDelivery({ ...validInput, driverId: "unknown" }, orders, []) ?? "",
    /سائقًا/u,
  );
  assert.match(
    validateDelivery(
      { ...validInput, orderId: getInitialDemoDeliveries()[0].orderId },
      orders,
      getInitialDemoDeliveries(),
    ) ?? "",
    /بالفعل/u,
  );
});

test("delivery references are generated and tied to the selected customer order", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  const delivery = createDelivery(validInput, orders, [], now, "delivery-test");
  assert.equal(delivery.id, "delivery-test");
  assert.equal(delivery.reference, "DLV-2026-001");
  assert.equal(delivery.customerId, orders[3].customerId);
  assert.equal(delivery.orderId, orders[3].id);
  assert.equal(delivery.status, "PENDING");
  assert.equal(delivery.createdAt, now.toISOString());
});

test("delivery status progresses and can fail before successful delivery", () => {
  assert.equal(getNextDeliveryStatus("PENDING"), "PREPARING");
  assert.equal(getNextDeliveryStatus("PREPARING"), "OUT_FOR_DELIVERY");
  assert.equal(getNextDeliveryStatus("OUT_FOR_DELIVERY"), "DELIVERED");
  assert.equal(getNextDeliveryStatus("DELIVERED"), null);
  assert.equal(getNextDeliveryStatus("FAILED"), null);
  assert.equal(canTransitionDeliveryStatus("PREPARING", "FAILED"), true);
  assert.equal(canTransitionDeliveryStatus("DELIVERED", "FAILED"), false);
  assert.equal(canTransitionDeliveryStatus("PENDING", "OUT_FOR_DELIVERY"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionShipment,
  parseDeliveryDate,
  validateDriverInput,
  validateRunInput,
  validateShipmentInput,
  validateVehicleInput,
} from "./delivery-state.ts";

test("shipment lifecycle allows only forward transitions and failed rescheduling", () => {
  assert.equal(canTransitionShipment("PREPARING", "READY_FOR_DISPATCH"), true);
  assert.equal(canTransitionShipment("DISPATCHED", "IN_TRANSIT"), true);
  assert.equal(canTransitionShipment("IN_TRANSIT", "DELIVERED"), true);
  assert.equal(canTransitionShipment("IN_TRANSIT", "DELIVERY_FAILED"), true);
  assert.equal(canTransitionShipment("DELIVERY_FAILED", "READY_FOR_DISPATCH"), true);

  for (const [current, next] of [
    ["PREPARING", "DISPATCHED"],
    ["READY_FOR_DISPATCH", "IN_TRANSIT"],
    ["DELIVERED", "DELIVERY_FAILED"],
    ["DELIVERY_FAILED", "DELIVERED"],
  ] as const) {
    assert.equal(canTransitionShipment(current, next), false);
  }
});

test("delivery date parser rejects malformed and impossible calendar dates", () => {
  assert.equal(parseDeliveryDate("2026-03-10")?.toISOString(), "2026-03-10T11:00:00.000Z");
  assert.equal(parseDeliveryDate("2026-02-30"), null);
  assert.equal(parseDeliveryDate("2026-2-3"), null);
  assert.equal(parseDeliveryDate(""), null);
});

test("shipment input validates identifiers, destination, date, and notes", () => {
  const valid = {
    orderId: "order-1",
    address: "Rue de la Liberté",
    region: "Alger",
    expectedDeliveryDate: "2026-03-10",
    notes: "",
  };
  assert.equal(validateShipmentInput(valid), null);
  assert.ok(validateShipmentInput({ ...valid, address: " " }));
  assert.ok(validateShipmentInput({ ...valid, region: "x".repeat(121) }));
  assert.ok(validateShipmentInput({ ...valid, expectedDeliveryDate: "invalid" }));
  assert.ok(validateShipmentInput({ ...valid, notes: "n".repeat(2001) }));
});

test("run and fleet inputs reject invalid values and lengths", () => {
  assert.equal(
    validateRunInput({
      region: "Alger",
      scheduledDate: "2026-03-10",
      priority: "URGENT",
      driverId: "driver-1",
      vehicleId: "vehicle-1",
    }),
    null,
  );
  assert.ok(validateRunInput({
    region: "Alger",
    scheduledDate: "2026-03-10",
    priority: "ASAP",
    driverId: "driver-1",
    vehicleId: "vehicle-1",
  }));
  assert.equal(validateDriverInput({ name: "Driver", phone: "+213123456" }), null);
  assert.ok(validateDriverInput({ name: " ", phone: "123" }));
  assert.equal(
    validateVehicleInput({
      plate: "123-ABC",
      label: "Delivery van",
      type: "VAN",
      maxStops: 10,
    }),
    null,
  );
  assert.ok(validateVehicleInput({
    plate: "123-ABC",
    label: "Delivery van",
    type: "VAN",
    maxStops: 0,
  }));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeliveryShipmentInTransaction,
  DeliveryOperationError,
  assignShipmentToRunInTransaction,
  markShipmentReadyInTransaction,
} from "./delivery-operations.ts";

test("duplicate shipment creation for a fulfilled order is rejected before writes", async () => {
  const writes = [];
  const tx = {
    $queryRaw: async () => [{ id: "order-1" }],
    customerOrder: {
      findUnique: async () => ({
        id: "order-1",
        orderNumber: "SO-2026-000001",
        status: "FULFILLED",
        customerName: "Fixture customer",
        customer: { name: "Fixture customer", phone: null },
      }),
    },
    deliveryShipment: {
      findUnique: async () => ({ id: "shipment-existing" }),
      create: async () => writes.push("shipment"),
    },
    deliveryEvent: {
      create: async () => writes.push("event"),
    },
  };

  await assert.rejects(
    createDeliveryShipmentInTransaction(tx, {
      orderId: "order-1",
      address: "Fixture address",
      region: "Alger",
      expectedDeliveryAt: new Date("2026-11-12T11:00:00.000Z"),
      notes: null,
      actorUserId: "operator-1",
    }),
    (error) =>
      error instanceof DeliveryOperationError &&
      error.message.includes("بالفعل"),
  );
  assert.deepEqual(writes, []);
});

test("a terminal shipment cannot be marked ready again", async () => {
  const writes = [];
  const tx = {
    $queryRaw: async () => [{ id: "shipment-1" }],
    deliveryShipment: {
      findUnique: async () => ({
        id: "shipment-1",
        runId: null,
        status: "DELIVERED",
      }),
      updateMany: async () => writes.push("shipment"),
    },
    deliveryEvent: {
      create: async () => writes.push("event"),
    },
  };

  await assert.rejects(
    markShipmentReadyInTransaction(tx, "shipment-1", "operator-1"),
    (error) =>
      error instanceof DeliveryOperationError &&
      error.message.includes("قيد التجهيز"),
  );
  assert.deepEqual(writes, []);
});

test("shipment cannot be assigned to a run scheduled for a different local day", async () => {
  const writes = [];
  const tx = {
    $queryRaw: async () => [{ id: "locked" }],
    deliveryRun: {
      findUnique: async () => ({
        id: "run-1",
        runNumber: "RUN-2026-000001",
        region: "Alger",
        status: "PLANNED",
        scheduledAt: new Date("2026-11-12T11:00:00.000Z"),
        driver: { isActive: true },
        vehicle: { isActive: true, maxStops: 5 },
      }),
    },
    deliveryShipment: {
      findUnique: async () => ({
        id: "shipment-1",
        region: "Alger",
        status: "READY_FOR_DISPATCH",
        runId: null,
        expectedDeliveryAt: new Date("2026-11-13T11:00:00.000Z"),
      }),
      count: async () => 0,
      update: async () => writes.push("shipment"),
    },
    deliveryEvent: {
      create: async () => writes.push("event"),
    },
  };

  await assert.rejects(
    assignShipmentToRunInTransaction(tx, "shipment-1", "run-1", "operator-1"),
    (error) =>
      error instanceof DeliveryOperationError &&
      error.message.includes("موعد الشحنة"),
  );
  assert.deepEqual(writes, []);
});

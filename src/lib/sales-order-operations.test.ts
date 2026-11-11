import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { fulfillCustomerOrderInTransaction } from "./sales-order-operations.ts";

function makeHarness() {
  const state = {
    order: {
      id: "order-1",
      orderNumber: "SO-2026-0000001",
      status: "CONFIRMED",
      fulfilledAt: null as Date | null,
      lines: [
        {
          id: "line-1",
          productId: "product-1",
          productName: "Finished product",
          orderedQuantity: 2,
        },
      ],
    },
    product: { id: "product-1", quantity: 8 },
    reservations: [
      {
        id: "reservation-1",
        orderId: "order-1",
        orderLineId: "line-1",
        productId: "product-1",
        quantity: 2,
        releasedAt: null as Date | null,
        releaseReason: null as string | null,
      },
    ],
    movements: [] as Record<string, unknown>[],
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) =>
      strings.join("").includes('"CustomerOrder"')
        ? [{ id: state.order.id }]
        : [{ id: state.product.id }],
    customerOrder: {
      findUnique: async () => state.order,
      updateMany: async ({
        where,
        data,
      }: {
        where: { status: string };
        data: { status: string; fulfilledAt: Date };
      }) => {
        if (state.order.status !== where.status) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    customerOrderReservation: {
      findMany: async () =>
        state.reservations
          .filter((reservation) => reservation.releasedAt === null)
          .map(({ id, orderLineId, productId, quantity }) => ({
            id,
            orderLineId,
            productId,
            quantity,
          })),
      updateMany: async ({
        data,
      }: {
        data: { releasedAt: Date; releaseReason: string };
      }) => {
        const active = state.reservations.filter(
          (reservation) => reservation.releasedAt === null,
        );
        for (const reservation of active) {
          Object.assign(reservation, data);
        }
        return { count: active.length };
      },
    },
    product: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; quantity: { gte: number } };
        data: { quantity: { decrement: number } };
      }) => {
        if (
          state.product.id !== where.id ||
          state.product.quantity < where.quantity.gte
        ) {
          return { count: 0 };
        }
        state.product.quantity -= data.quantity.decrement;
        return { count: 1 };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.movements.push(data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  return { state, tx };
}

test("fulfillment deducts reserved stock and records one OUT movement", async () => {
  const { state, tx } = makeHarness();
  const fulfilledAt = new Date("2026-11-11T12:00:00.000Z");

  await fulfillCustomerOrderInTransaction(tx, "order-1", fulfilledAt);

  assert.equal(state.order.status, "FULFILLED");
  assert.equal(state.order.fulfilledAt, fulfilledAt);
  assert.equal(state.product.quantity, 6);
  assert.equal(state.reservations[0].releasedAt, fulfilledAt);
  assert.equal(state.reservations[0].releaseReason, "FULFILLED");
  assert.deepEqual(state.movements, [
    {
      customerOrderId: "order-1",
      productId: "product-1",
      type: "OUT",
      quantity: 2,
      reason: "صرف طلب العميل SO-2026-0000001",
      reference: "SO-2026-0000001",
    },
  ]);

  await fulfillCustomerOrderInTransaction(tx, "order-1", fulfilledAt);
  assert.equal(state.movements.length, 1);
  assert.equal(state.product.quantity, 6);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  cancelProductionOrderInTransaction,
  completeProductionOrderInTransaction,
  ProductionOrderError,
  startProductionOrderInTransaction,
} from "./production-order-operations.ts";
import {
  calculateMaterialRequirements,
  parseProductionOrderQuantity,
} from "./production-orders.ts";

function component(
  id: string,
  quantityPerUnit: string,
  name = `Material ${id}`,
) {
  return {
    materialProductId: id,
    quantityPerUnit,
    materialName: name,
    materialSku: `SKU-${id}`,
    unit: "kg",
  };
}

function makeHarness(
  options: {
    material1Quantity?: number;
    material2Quantity?: number;
    bomStatus?: "RELEASED" | "RETIRED";
    failMovementAt?: number;
  } = {},
) {
  const state = {
    order: {
      id: "order-1",
      orderNumber: "PR-2026-0000001",
      status: "IN_PROGRESS",
      plannedQuantity: "3",
      producedQuantity: null as number | null,
      bom: {
        finishedProductId: "finished-1",
        components: [component("material-1", "2.5"), component("material-2", ".333333")],
      },
    },
    bom: {
      status: options.bomStatus ?? "RELEASED",
      releasedAt: new Date("2026-11-01T00:00:00.000Z"),
    },
    products: new Map([
      ["material-1", { id: "material-1", quantity: options.material1Quantity ?? 8 }],
      ["material-2", { id: "material-2", quantity: options.material2Quantity ?? 2 }],
      ["finished-1", { id: "finished-1", quantity: 1 }],
    ]),
    movements: [] as Record<string, unknown>[],
  };
  let movementCount = 0;
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      if (strings.join("").includes('"ProductionOrder"')) {
        return state.order ? [{ id: state.order.id }] : [];
      }
      if (strings.join("").includes('"BillOfMaterials"')) {
        return [{ id: "bom-1" }];
      }
      return [...state.products.values()];
    },
    productionOrder: {
      findUnique: async () => state.order,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.order, data);
        return state.order;
      },
    },
    billOfMaterials: {
      findUnique: async () => state.bom,
    },
    product: {
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] } };
      }) =>
        where.id.in
          .map((id) => state.products.get(id))
          .filter((product) => product !== undefined),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; quantity?: { gte: number } };
        data: { quantity: { decrement?: number; increment?: number } };
      }) => {
        const product = state.products.get(where.id);
        if (!product || (where.quantity && product.quantity < where.quantity.gte)) {
          return { count: 0 };
        }
        product.quantity +=
          data.quantity.increment ?? -(data.quantity.decrement ?? 0);
        return { count: 1 };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        movementCount += 1;
        if (movementCount === options.failMovementAt) {
          throw new Error("movement insert failed");
        }
        state.movements.push(data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  async function transaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ) {
    const snapshot = structuredClone(state);
    try {
      return await operation(tx);
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    }
  }

  return { state, tx, transaction };
}

test("production quantity and component calculations retain six-decimal precision", () => {
  assert.equal(parseProductionOrderQuantity("12.000001"), 12.000001);
  assert.equal(parseProductionOrderQuantity("0"), null);
  assert.equal(parseProductionOrderQuantity("1.0000001"), null);

  const result = calculateMaterialRequirements(
    [component("material-1", ".333333")],
    "3",
  );
  assert.deepEqual(result, {
    ok: true,
    requirements: [
      { ...component("material-1", ".333333"), requiredQuantity: 0.999999 },
    ],
  });
  assert.equal(
    calculateMaterialRequirements(
      [component("material-1", ".000001")],
      ".000001",
    ).ok,
    true,
  );
});

test("production calculations reject duplicate, self-referential, and excessive requirements", () => {
  assert.equal(
    calculateMaterialRequirements(
      [component("material-1", "1"), component("material-1", "2")],
      1,
    ).ok,
    false,
  );
  assert.equal(
    calculateMaterialRequirements(
      [component("finished-1", "1")],
      1,
      "finished-1",
    ).ok,
    false,
  );
  assert.equal(
    calculateMaterialRequirements([component("material-1", "1000000000")], 2)
      .ok,
    false,
  );
});

test("completion consumes inputs, records movements, and produces finished stock once", async () => {
  const harness = makeHarness({ bomStatus: "RETIRED" });
  await assert.rejects(
    harness.transaction((tx) =>
      completeProductionOrderInTransaction(tx, "order-1", "4"),
    ),
    /لا يمكن أن تتجاوز/u,
  );
  assert.equal(harness.state.order.status, "IN_PROGRESS");
  await harness.transaction((tx) =>
    completeProductionOrderInTransaction(tx, "order-1", "2"),
  );

  assert.equal(harness.state.order.status, "COMPLETED");
  assert.equal(harness.state.order.producedQuantity, 2);
  assert.equal(harness.state.products.get("material-1")?.quantity, 3);
  assert.equal(harness.state.products.get("material-2")?.quantity, 1.333334);
  assert.equal(harness.state.products.get("finished-1")?.quantity, 3);
  assert.deepEqual(
    harness.state.movements.map((movement) => [
      movement.productId,
      movement.type,
      movement.quantity,
    ]),
    [
      ["material-1", "OUT", 5],
      ["material-2", "OUT", 0.666666],
      ["finished-1", "IN", 2],
    ],
  );

  const beforeRetry = structuredClone(harness.state);
  await assert.rejects(
    harness.transaction((tx) =>
      completeProductionOrderInTransaction(tx, "order-1", "2"),
    ),
    ProductionOrderError,
  );
  assert.deepEqual(harness.state, beforeRetry);
});

test("insufficient material prevents every inventory and order change", async () => {
  const harness = makeHarness({ material1Quantity: 4 });
  const before = structuredClone(harness.state);
  await assert.rejects(
    harness.transaction((tx) =>
      completeProductionOrderInTransaction(tx, "order-1", "2"),
    ),
    /المخزون غير كافٍ/u,
  );
  assert.deepEqual(harness.state, before);
});

test("failed movement insertion rolls back consumption and production atomically", async () => {
  const harness = makeHarness({ failMovementAt: 2 });
  const before = structuredClone(harness.state);
  await assert.rejects(
    harness.transaction((tx) =>
      completeProductionOrderInTransaction(tx, "order-1", "2"),
    ),
    /movement insert failed/u,
  );
  assert.deepEqual(harness.state, before);
});

test("starting an order requires enough material and an active released BOM", async () => {
  const available = makeHarness();
  available.state.order.status = "DRAFT";
  await available.transaction((tx) =>
    startProductionOrderInTransaction(tx, "order-1"),
  );
  assert.equal(available.state.order.status, "IN_PROGRESS");

  const insufficient = makeHarness({ material1Quantity: 7 });
  insufficient.state.order.status = "DRAFT";
  await assert.rejects(
    insufficient.transaction((tx) =>
      startProductionOrderInTransaction(tx, "order-1"),
    ),
    /المخزون غير كافٍ/u,
  );
  assert.equal(insufficient.state.order.status, "DRAFT");

  const retired = makeHarness({ bomStatus: "RETIRED" });
  retired.state.order.status = "DRAFT";
  await assert.rejects(
    retired.transaction((tx) =>
      startProductionOrderInTransaction(tx, "order-1"),
    ),
    /مراجعة قائمة مواد معتمدة/u,
  );
  assert.equal(retired.state.order.status, "DRAFT");
});

test("cancellation changes only draft or in-progress order status", async () => {
  const harness = makeHarness();
  await harness.transaction((tx) =>
    cancelProductionOrderInTransaction(tx, "order-1"),
  );
  assert.equal(harness.state.order.status, "CANCELLED");
  assert.equal(harness.state.movements.length, 0);
  await assert.rejects(
    harness.transaction((tx) =>
      cancelProductionOrderInTransaction(tx, "order-1"),
    ),
    ProductionOrderError,
  );
});

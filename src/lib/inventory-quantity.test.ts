import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductWithInitialStock,
  parseInventoryQuantity,
} from "./inventory-quantity.ts";

test("inventory quantity parser accepts in-range decimal values", () => {
  assert.equal(parseInventoryQuantity("12.5", true), 12.5);
  assert.equal(parseInventoryQuantity(".125", false), 0.125);
  assert.equal(parseInventoryQuantity("0", true), 0);
  assert.equal(parseInventoryQuantity("1000000000", true), 1_000_000_000);
});

test("inventory quantity parser rejects empty and partially numeric strings", () => {
  for (const value of ["", "   ", "12items", "1.2.3", "1.", "1,5"]) {
    assert.equal(parseInventoryQuantity(value, true), null, value);
    assert.equal(parseInventoryQuantity(value, false), null, value);
  }
});

test("inventory quantity parser rejects negative values", () => {
  assert.equal(parseInventoryQuantity("-1", true), null);
  assert.equal(parseInventoryQuantity("-0.1", false), null);
});

test("inventory quantity parser rejects non-finite and out-of-range values", () => {
  for (const value of ["NaN", "Infinity", "-Infinity", "1e309", "1000000001"]) {
    assert.equal(parseInventoryQuantity(value, true), null, value);
    assert.equal(parseInventoryQuantity(value, false), null, value);
  }
});

test("minimum quantities reject missing, excessive-precision, and out-of-range values", () => {
  for (const value of [
    "",
    "-0.000001",
    "1.1234567",
    "1000000000.000001",
    "invalid",
  ]) {
    assert.equal(parseInventoryQuantity(value, true), null, value);
  }
  assert.equal(parseInventoryQuantity("0.000001", true), 0.000001);
});

test("movement quantities must be positive and within the precision limit", () => {
  for (const value of ["0", "-1", "2items", "Infinity", "0.0000001"]) {
    assert.equal(parseInventoryQuantity(value, false), null, value);
  }
  assert.equal(parseInventoryQuantity("2.125", false), 2.125);
});

test("mocked transaction creates an inbound movement for positive initial stock", async () => {
  const calls: { products: unknown[]; movements: unknown[] } = {
    products: [],
    movements: [],
  };
  const tx = {
    product: {
      create: async ({ data }: { data: unknown }) => {
        calls.products.push(data);
        return { id: "product-1" };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: unknown }) => {
        calls.movements.push(data);
        return data;
      },
    },
  } as unknown as Parameters<typeof createProductWithInitialStock>[0];

  const data = {
    name: "Product",
    sku: "SKU-1",
    unit: "piece",
    quantity: 4.5,
    minQuantity: 1,
  };
  await createProductWithInitialStock(tx, data);

  assert.deepEqual(calls.products, [data]);
  assert.deepEqual(calls.movements, [
    {
      productId: "product-1",
      type: "IN",
      quantity: 4.5,
      reason: "رصيد افتتاحي",
      reference: null,
    },
  ]);
});

test("mocked transaction omits a zero-quantity opening movement", async () => {
  const movements: unknown[] = [];
  const tx = {
    product: {
      create: async () => ({ id: "product-1" }),
    },
    stockMovement: {
      create: async ({ data }: { data: unknown }) => movements.push(data),
    },
  } as unknown as Parameters<typeof createProductWithInitialStock>[0];

  await createProductWithInitialStock(tx, {
    name: "Product",
    sku: "SKU-1",
    unit: "piece",
    quantity: 0,
    minQuantity: 0,
  });

  assert.equal(movements.length, 0);
});

test("mocked transaction rolls back product creation when movement insertion fails", async () => {
  let state = { products: 0, movements: 0 };
  const tx = {
    product: {
      create: async () => {
        state.products += 1;
        return { id: "product-1" };
      },
    },
    stockMovement: {
      create: async () => {
        throw new Error("movement insert failed");
      },
    },
  } as unknown as Parameters<typeof createProductWithInitialStock>[0];
  async function transaction<T>(operation: (client: typeof tx) => Promise<T>) {
    const snapshot = structuredClone(state);
    try {
      return await operation(tx);
    } catch (error) {
      state = snapshot;
      throw error;
    }
  }

  await assert.rejects(
    transaction((client) =>
      createProductWithInitialStock(client, {
        name: "Product",
        sku: "SKU-1",
        unit: "piece",
        quantity: 1,
        minQuantity: 0,
      }),
    ),
    /movement insert failed/u,
  );
  assert.deepEqual(state, { products: 0, movements: 0 });
});

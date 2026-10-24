import assert from "node:assert/strict";
import test from "node:test";
import {
  recordPurchaseOrderReceipt,
  type PurchaseOrderForReceipt,
} from "./purchase-order-receiving.ts";

type ReceiptTransaction = Parameters<typeof recordPurchaseOrderReceipt>[0];

type TestState = {
  order: PurchaseOrderForReceipt;
  productQuantity: number;
  receipts: { id: string; idempotencyKey: string }[];
  movements: {
    productId: string;
    purchaseOrderLineId: string;
    receiptId: string;
    type: "IN";
    quantity: number;
    reason: string;
    reference: string;
  }[];
};

function createHarness(options: { status?: PurchaseOrderForReceipt["status"]; failMovement?: boolean } = {}) {
  let state: TestState = {
    order: {
      id: "order-1",
      orderNumber: "PO-2026-0000001",
      status: options.status ?? "SUBMITTED",
      lines: [
        {
          id: "line-1",
          productId: "product-1",
          productName: "Product One",
          orderedQuantity: 5,
          receivedQuantity: 0,
        },
      ],
    },
    productQuantity: 10,
    receipts: [],
    movements: [],
  };

  const tx = {
    purchaseOrderReceipt: {
      create: async ({ data }: { data: { idempotencyKey: string } }) => {
        if (state.receipts.some((receipt) => receipt.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error("duplicate receipt token"), { code: "P2002" });
        }
        const receipt = {
          id: `receipt-${state.receipts.length + 1}`,
          idempotencyKey: data.idempotencyKey,
        };
        state.receipts.push(receipt);
        return { id: receipt.id };
      },
    },
    purchaseOrderLine: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; receivedQuantity: number };
        data: { receivedQuantity: number };
      }) => {
        const line = state.order.lines.find((item) => item.id === where.id);
        if (!line || line.receivedQuantity !== where.receivedQuantity) {
          return { count: 0 };
        }
        line.receivedQuantity = data.receivedQuantity;
        return { count: 1 };
      },
    },
    product: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { quantity: { increment: number } };
      }) => {
        if (where.id !== "product-1") return { count: 0 };
        state.productQuantity += data.quantity.increment;
        return { count: 1 };
      },
    },
    stockMovement: {
      create: async ({
        data,
      }: {
        data: TestState["movements"][number];
      }) => {
        if (options.failMovement) throw new Error("movement insert failed");
        state.movements.push(data);
        return data;
      },
    },
    purchaseOrder: {
      update: async ({
        data,
      }: {
        data: { status: PurchaseOrderForReceipt["status"] };
      }) => {
        state.order.status = data.status;
        return state.order;
      },
    },
  } as unknown as ReceiptTransaction;

  async function transaction<T>(operation: (client: ReceiptTransaction) => Promise<T>) {
    const snapshot = structuredClone(state);
    try {
      return await operation(tx);
    } catch (error) {
      state = snapshot;
      throw error;
    }
  }

  return {
    get state() {
      return state;
    },
    transaction,
  };
}

test("partial and final receipts create matching inbound movements", async () => {
  const harness = createHarness();

  await harness.transaction((tx) =>
    recordPurchaseOrderReceipt(tx, harness.state.order, "receipt-token-1", new Map([["line-1", 2]])),
  );
  assert.equal(harness.state.productQuantity, 12);
  assert.equal(harness.state.order.lines[0].receivedQuantity, 2);
  assert.equal(harness.state.order.status, "PARTIALLY_RECEIVED");
  assert.equal(harness.state.movements.length, 1);
  assert.equal(harness.state.movements[0].type, "IN");
  assert.equal(harness.state.movements[0].quantity, 2);
  assert.equal(harness.state.movements[0].receiptId, harness.state.receipts[0].id);

  await harness.transaction((tx) =>
    recordPurchaseOrderReceipt(tx, harness.state.order, "receipt-token-2", new Map([["line-1", 3]])),
  );
  assert.equal(harness.state.productQuantity, 15);
  assert.equal(harness.state.order.lines[0].receivedQuantity, 5);
  assert.equal(harness.state.order.status, "RECEIVED");
  assert.equal(harness.state.movements.length, 2);
  assert.equal(harness.state.movements[1].quantity, 3);
});

test("a duplicate idempotency key cannot add another movement", async () => {
  const harness = createHarness();
  const requested = new Map([["line-1", 2]]);

  await harness.transaction((tx) =>
    recordPurchaseOrderReceipt(tx, harness.state.order, "reused-token", requested),
  );
  await assert.rejects(
    harness.transaction((tx) =>
      recordPurchaseOrderReceipt(tx, harness.state.order, "reused-token", requested),
    ),
    { code: "P2002" },
  );

  assert.equal(harness.state.productQuantity, 12);
  assert.equal(harness.state.movements.length, 1);
  assert.equal(harness.state.receipts.length, 1);
});

test("cancelled orders and over-receipts leave no persisted receipt", async () => {
  const cancelled = createHarness({ status: "CANCELLED" });
  await assert.rejects(
    cancelled.transaction((tx) =>
      recordPurchaseOrderReceipt(tx, cancelled.state.order, "cancelled-token", new Map([["line-1", 1]])),
    ),
    /لا يمكن الاستلام/u,
  );
  assert.equal(cancelled.state.receipts.length, 0);

  const excessive = createHarness();
  await assert.rejects(
    excessive.transaction((tx) =>
      recordPurchaseOrderReceipt(tx, excessive.state.order, "excessive-token", new Map([["line-1", 6]])),
    ),
    /تتجاوز الكمية المتبقية/u,
  );
  assert.equal(excessive.state.productQuantity, 10);
  assert.equal(excessive.state.receipts.length, 0);
  assert.equal(excessive.state.movements.length, 0);
});

test("a movement failure rolls back receipt and quantity changes", async () => {
  const harness = createHarness({ failMovement: true });
  const before = structuredClone(harness.state);

  await assert.rejects(
    harness.transaction((tx) =>
      recordPurchaseOrderReceipt(tx, harness.state.order, "rollback-token", new Map([["line-1", 2]])),
    ),
    /movement insert failed/u,
  );

  assert.deepEqual(harness.state, before);
});
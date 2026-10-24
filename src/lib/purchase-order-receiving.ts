import type { Prisma } from "@prisma/client";
import {
  calculateReceipt,
  derivePurchaseOrderStatus,
  type PurchaseOrderStatus,
  type ReceiptLine,
} from "./purchase-order-state.ts";

export class PurchasingError extends Error {}

export type PurchaseOrderForReceipt = {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  lines: (ReceiptLine & {
    id: string;
    productId: string;
    productName: string;
  })[];
};

type ReceivingTransaction = Pick<
  Prisma.TransactionClient,
  | "purchaseOrderReceipt"
  | "purchaseOrderLine"
  | "product"
  | "stockMovement"
  | "purchaseOrder"
>;

export async function recordPurchaseOrderReceipt(
  tx: ReceivingTransaction,
  order: PurchaseOrderForReceipt,
  receiptToken: string,
  requested: ReadonlyMap<string, number>,
) {
  if (
    order.status !== "SUBMITTED" &&
    order.status !== "PARTIALLY_RECEIVED"
  ) {
    throw new PurchasingError("لا يمكن الاستلام من أمر غير مرسل أو مكتمل.");
  }

  const receiptBatch = await tx.purchaseOrderReceipt.create({
    data: { idempotencyKey: receiptToken, purchaseOrderId: order.id },
    select: { id: true },
  });
  const linesById = new Map(order.lines.map((line) => [line.id, line]));

  for (const [lineId, quantity] of requested) {
    const line = linesById.get(lineId);
    if (!line) throw new PurchasingError("أحد أصناف الاستلام لا يتبع هذا الأمر.");
    const receipt = calculateReceipt(line, quantity);
    if (!receipt) {
      throw new PurchasingError(
        `الكمية المطلوبة للصنف «${line.productName}» تتجاوز الكمية المتبقية.`,
      );
    }

    const lineUpdate = await tx.purchaseOrderLine.updateMany({
      where: { id: line.id, receivedQuantity: line.receivedQuantity },
      data: { receivedQuantity: receipt.receivedQuantity },
    });
    if (lineUpdate.count !== 1) {
      throw new PurchasingError("تغيرت بيانات الاستلام. حدّث الصفحة وحاول مرة أخرى.");
    }

    const productUpdate = await tx.product.updateMany({
      where: { id: line.productId },
      data: { quantity: { increment: receipt.quantity } },
    });
    if (productUpdate.count !== 1) {
      throw new PurchasingError(`الصنف «${line.productName}» لم يعد موجودًا.`);
    }

    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        purchaseOrderLineId: line.id,
        receiptId: receiptBatch.id,
        type: "IN",
        quantity: receipt.quantity,
        reason: `استلام أمر شراء ${order.orderNumber}`,
        reference: order.orderNumber,
      },
    });
    line.receivedQuantity = receipt.receivedQuantity;
  }

  const status = derivePurchaseOrderStatus(order.lines);
  await tx.purchaseOrder.update({
    where: { id: order.id },
    data: {
      status,
      ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}),
    },
  });
  order.status = status;
}
"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  parsePositiveQuantity,
} from "@/lib/purchase-order-state";
import {
  PurchasingError,
  recordPurchaseOrderReceipt,
} from "@/lib/purchase-order-receiving";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";

type ActionResult = { ok: boolean; error?: string; id?: string };
type OrderLineInput = { productId: string; quantity: number };
type TransactionClient = Prisma.TransactionClient;
const MAX_ORDER_LINES = 100;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalField(
  formData: FormData,
  name: string,
  label: string,
  maxLength: number,
) {
  const value = field(formData, name);
  if (value.length > maxLength) {
    throw new PurchasingError(`يجب ألا يتجاوز حقل ${label} ${maxLength} حرفًا.`);
  }
  return value || null;
}

function supplierFields(formData: FormData) {
  const name = field(formData, "name").replace(/\s+/gu, " ");
  if (!name) throw new PurchasingError("اسم المورد مطلوب.");
  if (name.length > 120) {
    throw new PurchasingError("يجب ألا يتجاوز اسم المورد 120 حرفًا.");
  }

  const email = optionalField(formData, "email", "البريد الإلكتروني", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new PurchasingError("أدخل عنوان بريد إلكتروني صالحًا.");
  }

  return {
    name,
    nameKey: name.normalize("NFKC").toLocaleLowerCase("ar"),
    contactPerson: optionalField(formData, "contactPerson", "الشخص المسؤول", 120),
    phone: optionalField(formData, "phone", "الهاتف", 40),
    email,
    address: optionalField(formData, "address", "العنوان", 300),
    notes: optionalField(formData, "notes", "الملاحظات", 2000),
    isActive: formData.get("isActive") === "on",
  };
}

function orderLines(formData: FormData): OrderLineInput[] {
  const productIds = formData.getAll("productId").map((value) => String(value).trim());
  const quantities = formData.getAll("quantity").map((value) => String(value).trim());
  if (productIds.length !== quantities.length) {
    throw new PurchasingError("تحقق من أصناف وكميات أمر الشراء.");
  }
  if (productIds.length > MAX_ORDER_LINES) {
    throw new PurchasingError(
      `لا يمكن أن يتجاوز أمر الشراء ${MAX_ORDER_LINES} صنفًا.`,
    );
  }

  const lines: OrderLineInput[] = [];
  const seenProducts = new Set<string>();
  for (let index = 0; index < productIds.length; index += 1) {
    const productId = productIds[index];
    const rawQuantity = quantities[index];
    if (!productId && !rawQuantity) continue;
    if (!productId) throw new PurchasingError("اختر صنفًا لكل كمية مدخلة.");
    const quantity = parsePositiveQuantity(rawQuantity);
    if (quantity === null) {
      throw new PurchasingError("يجب أن تكون كمية كل صنف رقمًا أكبر من صفر.");
    }
    if (seenProducts.has(productId)) {
      throw new PurchasingError("لا تكرر الصنف نفسه في أمر الشراء.");
    }
    seenProducts.add(productId);
    lines.push({ productId, quantity });
  }

  if (lines.length === 0) {
    throw new PurchasingError("أضف صنفًا واحدًا على الأقل إلى أمر الشراء.");
  }
  return lines;
}

function prismaErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function revalidatePurchasing(orderId?: string) {
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");
  if (orderId) revalidatePath(`/purchase-orders/${orderId}`);
}

function actionError(error: unknown, fallback: string): ActionResult {
  if (error instanceof PurchasingError) return { ok: false, error: error.message };
  console.error("Purchasing operation failed", {
    code: prismaErrorCode(error),
  });
  return { ok: false, error: fallback };
}

export async function createSupplier(formData: FormData): Promise<ActionResult> {
  await requirePermission("supplier.manage");

  try {
    const supplier = supplierFields(formData);
    const created = await prisma.supplier.create({ data: supplier });
    revalidatePurchasing();
    return { ok: true, id: created.id };
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      return { ok: false, error: "يوجد مورد مسجل بهذا الاسم بالفعل." };
    }
    return actionError(error, "تعذّر حفظ المورد. حاول مرة أخرى.");
  }
}

export async function updateSupplier(formData: FormData): Promise<ActionResult> {
  await requirePermission("supplier.manage");

  const id = field(formData, "id");
  if (!id) return { ok: false, error: "المورد غير محدد." };

  try {
    const supplier = supplierFields(formData);
    await prisma.supplier.update({ where: { id }, data: supplier });
    revalidatePurchasing();
    return { ok: true, id };
  } catch (error) {
    const code = prismaErrorCode(error);
    if (code === "P2002") {
      return { ok: false, error: "يوجد مورد آخر مسجل بهذا الاسم بالفعل." };
    }
    if (code === "P2025") {
      return { ok: false, error: "المورد غير موجود." };
    }
    return actionError(error, "تعذّر تحديث المورد. حاول مرة أخرى.");
  }
}

async function productSnapshots(
  tx: TransactionClient,
  lines: OrderLineInput[],
) {
  const products = await tx.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    select: { id: true, name: true, sku: true, unit: true },
  });
  if (products.length !== lines.length) {
    throw new PurchasingError("تعذّر العثور على أحد الأصناف المحددة.");
  }
  const productById = new Map(products.map((product) => [product.id, product]));
  return lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) throw new PurchasingError("الصنف المحدد غير موجود.");
    return {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unit: product.unit,
      orderedQuantity: line.quantity,
    };
  });
}

async function activeSupplier(tx: TransactionClient, supplierId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Supplier" WHERE "id" = ${supplierId} FOR SHARE
  `;
  if (locked.length === 0) {
    throw new PurchasingError("المورد غير موجود أو غير نشط.");
  }
  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, isActive: true },
  });
  if (!supplier || !supplier.isActive) {
    throw new PurchasingError("المورد غير موجود أو غير نشط.");
  }
  return supplier;
}

function orderYear(date: Date) {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  })
    .formatToParts(date)
    .find((part) => part.type === "year")?.value;
  if (!year) throw new Error("Could not determine the purchase order year");
  return year;
}

export async function createPurchaseOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("purchase_order.create");

  const supplierId = field(formData, "supplierId");
  if (!supplierId) return { ok: false, error: "اختر موردًا نشطًا." };

  try {
    const lines = orderLines(formData);
    const created = await prisma.$transaction(async (tx) => {
      await activeSupplier(tx, supplierId);
      const snapshots = await productSnapshots(tx, lines);
      const [sequence] = await tx.$queryRaw<Array<{ value: string }>>`
        SELECT nextval('"PurchaseOrder_orderNumber_seq"')::text AS value
      `;
      if (!sequence) throw new Error("Purchase order sequence returned no value");
      const orderNumber = `PO-${orderYear(new Date())}-${sequence.value.padStart(7, "0")}`;
      return tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          lines: { create: snapshots },
        },
        select: { id: true },
      });
    });
    revalidatePurchasing(created.id);
    return { ok: true, id: created.id };
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      return { ok: false, error: "تعذّر إنشاء رقم فريد لأمر الشراء. حاول مرة أخرى." };
    }
    return actionError(error, "تعذّر إنشاء أمر الشراء. حاول مرة أخرى.");
  }
}

async function lockPurchaseOrder(
  tx: TransactionClient,
  id: string,
) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE
  `;
  if (locked.length === 0) throw new PurchasingError("أمر الشراء غير موجود.");
  const order = await tx.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, isActive: true } },
      lines: true,
    },
  });
  if (!order) throw new PurchasingError("أمر الشراء غير موجود.");
  return order;
}

export async function updatePurchaseOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("purchase_order.edit_draft");

  const id = field(formData, "id");
  const supplierId = field(formData, "supplierId");
  if (!id || !supplierId) {
    return { ok: false, error: "أمر الشراء والمورد مطلوبان." };
  }

  try {
    const lines = orderLines(formData);
    await prisma.$transaction(async (tx) => {
      const order = await lockPurchaseOrder(tx, id);
      if (order.status !== "DRAFT") {
        throw new PurchasingError("يمكن تعديل أوامر المسودة فقط.");
      }
      await activeSupplier(tx, supplierId);
      const snapshots = await productSnapshots(tx, lines);
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId,
          lines: { create: snapshots },
        },
      });
    });
    revalidatePurchasing(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر تحديث المسودة. حاول مرة أخرى.");
  }
}

export async function submitPurchaseOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("purchase_order.submit");

  const id = field(formData, "id");
  if (!id) return { ok: false, error: "أمر الشراء غير محدد." };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await lockPurchaseOrder(tx, id);
      if (order.status !== "DRAFT") {
        throw new PurchasingError("لا يمكن إرسال هذا الأمر في حالته الحالية.");
      }
      if (order.lines.length === 0) {
        throw new PurchasingError("أضف صنفًا واحدًا على الأقل قبل إرسال الأمر.");
      }
      const supplier = await activeSupplier(tx, order.supplierId);
      if (!supplier.isActive) throw new PurchasingError("فعّل المورد قبل إرسال الأمر.");
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
    });
    revalidatePurchasing(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر إرسال أمر الشراء. حاول مرة أخرى.");
  }
}

export async function cancelPurchaseOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("purchase_order.cancel");

  const id = field(formData, "id");
  if (!id) return { ok: false, error: "أمر الشراء غير محدد." };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await lockPurchaseOrder(tx, id);
      if (order.status !== "DRAFT" && order.status !== "SUBMITTED") {
        throw new PurchasingError("لا يمكن إلغاء الأمر بعد بدء الاستلام.");
      }
      if (order.lines.some((line) => line.receivedQuantity > 0)) {
        throw new PurchasingError("لا يمكن إلغاء أمر يحتوي على كميات مستلمة.");
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    });
    revalidatePurchasing(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر إلغاء أمر الشراء. حاول مرة أخرى.");
  }
}

export async function receivePurchaseOrder(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("purchase_order.receive");

  const id = field(formData, "id");
  const receiptToken = field(formData, "receiptToken");
  if (!id) return { ok: false, error: "أمر الشراء غير محدد." };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      receiptToken,
    )
  ) {
    return { ok: false, error: "انتهت صلاحية نموذج الاستلام. حدّث الصفحة وحاول مجددًا." };
  }

  const requested = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("receipt-")) continue;
    const lineId = key.slice("receipt-".length);
    if (requested.has(lineId)) {
      return { ok: false, error: "لا ترسل كمية استلام مكررة للصنف نفسه." };
    }
    const raw = String(value).trim();
    if (!raw) continue;
    const quantity = parsePositiveQuantity(raw);
    if (quantity === null) {
      return { ok: false, error: "أدخل كمية استلام صالحة وأكبر من صفر." };
    }
    requested.set(lineId, quantity);
  }
  if (requested.size === 0) {
    return { ok: false, error: "أدخل كمية استلام لصنف واحد على الأقل." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await lockPurchaseOrder(tx, id);
      await recordPurchaseOrderReceipt(tx, order, receiptToken, requested);
    });
    revalidatePurchasing(id);
    return { ok: true, id };
  } catch (error) {
    if (prismaErrorCode(error) === "P2002") {
      return {
        ok: false,
        error: "تم تسجيل هذا الاستلام مسبقًا. حدّث الصفحة للتحقق من الحالة.",
      };
    }
    return actionError(error, "تعذّر تسجيل الاستلام. لم تُحدّث الكميات.");
  }
}

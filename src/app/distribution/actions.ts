"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  cancelDeliveryRunInTransaction,
  assignShipmentToRunInTransaction,
  confirmShipmentDeliveryInTransaction,
  createDeliveryRunInTransaction,
  createDeliveryShipmentInTransaction,
  dispatchDeliveryRunInTransaction,
  DeliveryOperationError,
  failShipmentDeliveryInTransaction,
  markShipmentReadyInTransaction,
  rescheduleFailedShipmentInTransaction,
  setDriverActiveInTransaction,
  setVehicleActiveInTransaction,
  startShipmentTransitInTransaction,
} from "@/lib/delivery-operations";
import {
  isDeliveryPriority,
  isDeliveryVehicleType,
  parseDeliveryDate,
  validateDriverInput,
  validateRunInput,
  validateShipmentInput,
  validateVehicleInput,
} from "@/lib/delivery-state";

type ActionResult = { ok: boolean; id?: string; error?: string };
type TransactionClient = Prisma.TransactionClient;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function actionError(error: unknown, fallback: string): ActionResult {
  if (error instanceof DeliveryOperationError) {
    return { ok: false, error: error.message };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return {
      ok: false,
      error: "يوجد سجل مرتبط بهذه البيانات بالفعل.",
    };
  }
  console.error("Distribution operation failed", {
    code:
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined,
  });
  return { ok: false, error: fallback };
}

function revalidateDistribution(shipmentId?: string, runId?: string) {
  revalidatePath("/distribution");
  revalidatePath("/distribution/deliveries");
  revalidatePath("/distribution/runs");
  revalidatePath("/distribution/fleet");
  revalidatePath("/control-tower");
  if (shipmentId) revalidatePath(`/distribution/deliveries/${shipmentId}`);
  if (runId) revalidatePath(`/distribution/runs/${runId}`);
}

async function shipmentOperation(
  id: string,
  operation: (tx: TransactionClient, shipmentId: string, actorId: string) => Promise<void>,
  fallback: string,
): Promise<ActionResult> {
  const principal = await requirePermission("distribution.manage");
  if (!id.trim()) return { ok: false, error: "الشحنة غير محددة." };
  try {
    await prisma.$transaction((tx) => operation(tx, id, principal.id));
    revalidateDistribution(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, fallback);
  }
}

export async function createDeliveryShipment(
  formData: FormData,
): Promise<ActionResult> {
  const principal = await requirePermission("distribution.manage");
  const input = {
    orderId: field(formData, "orderId"),
    address: field(formData, "address"),
    region: field(formData, "region"),
    expectedDeliveryDate: field(formData, "expectedDeliveryDate"),
    notes: field(formData, "notes"),
  };
  const validation = validateShipmentInput(input);
  if (validation) return { ok: false, error: validation };
  const expectedDeliveryAt = parseDeliveryDate(input.expectedDeliveryDate);
  if (!expectedDeliveryAt) return { ok: false, error: "أدخل تاريخ توصيل صالحًا." };
  if (expectedDeliveryAt.getTime() < Date.now()) {
    return { ok: false, error: "لا يمكن تحديد تاريخ توصيل في الماضي." };
  }

  try {
    const shipment = await prisma.$transaction((tx) =>
      createDeliveryShipmentInTransaction(
        tx,
        {
          ...input,
          expectedDeliveryAt,
          notes: input.notes || null,
          actorUserId: principal.id,
        },
      ),
    );
    revalidateDistribution(shipment.id);
    return { ok: true, id: shipment.id };
  } catch (error) {
    return actionError(error, "تعذّر إنشاء الشحنة.");
  }
}

export async function markDeliveryShipmentReady(id: string) {
  return shipmentOperation(
    id,
    (tx, shipmentId, actorId) =>
      markShipmentReadyInTransaction(tx, shipmentId, actorId),
    "تعذّر تجهيز الشحنة.",
  );
}

export async function assignDeliveryShipmentToRun(
  shipmentId: string,
  runId: string,
): Promise<ActionResult> {
  const principal = await requirePermission("distribution.manage");
  if (!shipmentId.trim() || !runId.trim()) {
    return { ok: false, error: "حدد الشحنة والمسار." };
  }
  try {
    await prisma.$transaction((tx) =>
      assignShipmentToRunInTransaction(
        tx,
        shipmentId,
        runId,
        principal.id,
      ),
    );
    revalidateDistribution(shipmentId, runId);
    return { ok: true, id: shipmentId };
  } catch (error) {
    return actionError(error, "تعذّر إسناد الشحنة إلى المسار.");
  }
}

export async function createDeliveryRun(
  formData: FormData,
): Promise<ActionResult> {
  const principal = await requirePermission("distribution.manage");
  const input = {
    region: field(formData, "region"),
    scheduledDate: field(formData, "scheduledDate"),
    priority: field(formData, "priority"),
    driverId: field(formData, "driverId"),
    vehicleId: field(formData, "vehicleId"),
  };
  const validation = validateRunInput(input);
  if (validation) return { ok: false, error: validation };
  if (!isDeliveryPriority(input.priority)) {
    return { ok: false, error: "اختر أولوية صالحة." };
  }
  const scheduledAt = parseDeliveryDate(input.scheduledDate);
  if (!scheduledAt) return { ok: false, error: "أدخل تاريخًا صالحًا للمسار." };
  if (scheduledAt.getTime() < Date.now()) {
    return { ok: false, error: "لا يمكن تخطيط مسار في تاريخ سابق." };
  }
  const priority = input.priority;
  if (!isDeliveryPriority(priority)) {
    return { ok: false, error: "اختر أولوية صالحة." };
  }

  try {
    const run = await prisma.$transaction((tx) =>
      createDeliveryRunInTransaction(tx, {
        region: input.region,
        priority,
        scheduledAt,
        driverId: input.driverId,
        vehicleId: input.vehicleId,
        actorUserId: principal.id,
      }),
    );
    revalidateDistribution(undefined, run.id);
    return { ok: true, id: run.id };
  } catch (error) {
    return actionError(error, "تعذّر إنشاء مسار التوصيل.");
  }
}

export async function dispatchDeliveryRun(id: string): Promise<ActionResult> {
  const principal = await requirePermission("distribution.manage");
  if (!id.trim()) return { ok: false, error: "مسار التوصيل غير محدد." };
  try {
    await prisma.$transaction((tx) =>
      dispatchDeliveryRunInTransaction(tx, id, principal.id),
    );
    revalidateDistribution(undefined, id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر إرسال المسار.");
  }
}

export async function cancelDeliveryRun(id: string): Promise<ActionResult> {
  await requirePermission("distribution.manage");
  if (!id.trim()) return { ok: false, error: "مسار التوصيل غير محدد." };
  try {
    await prisma.$transaction((tx) => cancelDeliveryRunInTransaction(tx, id));
    revalidateDistribution(undefined, id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر إلغاء المسار.");
  }
}

export async function startDeliveryTransit(id: string) {
  return shipmentOperation(
    id,
    (tx, shipmentId, actorId) =>
      startShipmentTransitInTransaction(tx, shipmentId, actorId),
    "تعذّر بدء التوصيل.",
  );
}

export async function confirmDeliveryReceived(
  formData: FormData,
): Promise<ActionResult> {
  const id = field(formData, "shipmentId");
  const receiverName = field(formData, "receiverName");
  const notes = field(formData, "deliveryNotes");
  if (receiverName.length > 160 || notes.length > 1000) {
    return { ok: false, error: "تحقق من طول بيانات الاستلام." };
  }
  return shipmentOperation(
    id,
    (tx, shipmentId, actorId) =>
      confirmShipmentDeliveryInTransaction(
        tx,
        shipmentId,
        actorId,
        receiverName,
        notes || null,
      ),
    "تعذّر تأكيد الاستلام.",
  );
}

export async function failDeliveryAttempt(
  formData: FormData,
): Promise<ActionResult> {
  const id = field(formData, "shipmentId");
  const reason = field(formData, "reason");
  if (reason.length > 1000) {
    return { ok: false, error: "يجب ألا يتجاوز سبب التعذّر 1000 حرف." };
  }
  return shipmentOperation(
    id,
    (tx, shipmentId, actorId) =>
      failShipmentDeliveryInTransaction(tx, shipmentId, actorId, reason),
    "تعذّر تسجيل محاولة التسليم.",
  );
}

export async function rescheduleDelivery(
  formData: FormData,
): Promise<ActionResult> {
  const id = field(formData, "shipmentId");
  const expectedDeliveryDate = parseDeliveryDate(
    field(formData, "expectedDeliveryDate"),
  );
  if (!expectedDeliveryDate) {
    return { ok: false, error: "أدخل تاريخًا صالحًا لإعادة التوصيل." };
  }
  return shipmentOperation(
    id,
    (tx, shipmentId, actorId) =>
      rescheduleFailedShipmentInTransaction(
        tx,
        shipmentId,
        actorId,
        expectedDeliveryDate,
      ),
    "تعذّر إعادة جدولة الشحنة.",
  );
}

export async function createDeliveryDriver(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("distribution.manage");
  const name = field(formData, "name");
  const phone = field(formData, "phone");
  const validation = validateDriverInput({ name, phone });
  if (validation) return { ok: false, error: validation };
  try {
    const driver = await prisma.deliveryDriver.create({
      data: { name, phone },
      select: { id: true },
    });
    revalidateDistribution();
    return { ok: true, id: driver.id };
  } catch (error) {
    return actionError(error, "تعذّر تسجيل السائق.");
  }
}

export async function createDeliveryVehicle(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("distribution.manage");
  const input = {
    plate: field(formData, "plate").toLocaleUpperCase("en"),
    label: field(formData, "label"),
    type: field(formData, "type"),
    maxStops: Number(field(formData, "maxStops")),
  };
  const validation = validateVehicleInput(input);
  if (validation) return { ok: false, error: validation };
  if (!isDeliveryVehicleType(input.type)) {
    return { ok: false, error: "اختر نوع مركبة صالحًا." };
  }
  try {
    const vehicle = await prisma.deliveryVehicle.create({
      data: {
        plate: input.plate,
        label: input.label,
        type: input.type,
        maxStops: input.maxStops,
      },
      select: { id: true },
    });
    revalidateDistribution();
    return { ok: true, id: vehicle.id };
  } catch (error) {
    return actionError(error, "تعذّر تسجيل المركبة.");
  }
}

export async function setDeliveryDriverActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requirePermission("distribution.manage");
  if (!id.trim()) return { ok: false, error: "السائق غير محدد." };
  try {
    await prisma.$transaction((tx) =>
      setDriverActiveInTransaction(tx, id, isActive),
    );
    revalidateDistribution();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر تحديث حالة السائق.");
  }
}

export async function setDeliveryVehicleActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requirePermission("distribution.manage");
  if (!id.trim()) return { ok: false, error: "المركبة غير محددة." };
  try {
    await prisma.$transaction((tx) =>
      setVehicleActiveInTransaction(tx, id, isActive),
    );
    revalidateDistribution();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "تعذّر تحديث حالة المركبة.");
  }
}

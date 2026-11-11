import "server-only";
import type { Prisma as PrismaTypes } from "@prisma/client";
import type {
  DeliveryPriority,
  DeliveryShipmentStatus,
  DeliveryVehicleType,
} from "./delivery-state.ts";
import { deliveryDayRange } from "./delivery-state.ts";

type TransactionClient = PrismaTypes.TransactionClient;

export class DeliveryOperationError extends Error {}

function currentYear(now: Date) {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  })
    .formatToParts(now)
    .find((part) => part.type === "year")?.value;
  if (!year) throw new Error("Could not determine the delivery reference year");
  return year;
}

async function lockRun(tx: TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DeliveryRun" WHERE "id" = ${id} FOR UPDATE
  `;
  if (rows.length === 0) throw new DeliveryOperationError("مسار التوصيل غير موجود.");
}

async function lockShipment(tx: TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DeliveryShipment" WHERE "id" = ${id} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new DeliveryOperationError("الشحنة غير موجودة.");
  }
}

async function lockShipmentAndRun(tx: TransactionClient, id: string) {
  const current = await tx.deliveryShipment.findUnique({
    where: { id },
    select: { runId: true },
  });
  if (!current) throw new DeliveryOperationError("الشحنة غير موجودة.");
  if (current.runId) await lockRun(tx, current.runId);
  await lockShipment(tx, id);
  const shipment = await tx.deliveryShipment.findUnique({ where: { id } });
  if (!shipment) throw new DeliveryOperationError("الشحنة غير موجودة.");
  return shipment;
}

async function recordShipmentEvent(
  tx: TransactionClient,
  input: {
    shipmentId: string;
    actorUserId: string;
    type:
      | "CREATED"
      | "STATUS_CHANGED"
      | "ASSIGNED_TO_RUN"
      | "RESCHEDULED"
      | "RUN_DISPATCHED";
    fromStatus?: DeliveryShipmentStatus | null;
    toStatus?: DeliveryShipmentStatus | null;
    runId?: string | null;
    reason?: string | null;
    receiverName?: string | null;
    expectedDeliveryAt?: Date | null;
  },
) {
  await tx.deliveryEvent.create({
    data: {
      shipmentId: input.shipmentId,
      actorUserId: input.actorUserId,
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      runId: input.runId ?? null,
      reason: input.reason ?? null,
      receiverName: input.receiverName ?? null,
      expectedDeliveryAt: input.expectedDeliveryAt ?? null,
    },
  });
}

export async function createDeliveryShipmentInTransaction(
  tx: TransactionClient,
  input: {
    orderId: string;
    address: string;
    region: string;
    expectedDeliveryAt: Date;
    notes: string | null;
    actorUserId: string;
  },
  now = new Date(),
) {
  const lockedOrder = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CustomerOrder" WHERE "id" = ${input.orderId} FOR UPDATE
  `;
  if (lockedOrder.length === 0) {
    throw new DeliveryOperationError("طلب العميل غير موجود.");
  }

  const order = await tx.customerOrder.findUnique({
    where: { id: input.orderId },
    include: { customer: { select: { name: true, phone: true } } },
  });
  if (!order) throw new DeliveryOperationError("طلب العميل غير موجود.");
  if (order.status !== "FULFILLED") {
    throw new DeliveryOperationError("يمكن إنشاء شحنة لطلب مكتمل فقط.");
  }
  const existing = await tx.deliveryShipment.findUnique({
    where: { orderId: input.orderId },
    select: { id: true },
  });
  if (existing) {
    throw new DeliveryOperationError("يوجد سجل توصيل مرتبط بهذا الطلب بالفعل.");
  }

  const [sequence] = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT nextval('"DeliveryShipment_reference_seq"')::text AS value
  `;
  if (!sequence) throw new Error("Delivery reference sequence returned no value");

  const shipment = await tx.deliveryShipment.create({
    data: {
      reference: `DLV-${currentYear(now)}-${sequence.value.padStart(6, "0")}`,
      orderId: order.id,
      customerName: order.customerName || order.customer.name,
      customerPhone: order.customer.phone,
      region: input.region.trim(),
      address: input.address.trim(),
      expectedDeliveryAt: input.expectedDeliveryAt,
      notes: input.notes,
      createdByUserId: input.actorUserId,
    },
    select: { id: true, reference: true },
  });
  await recordShipmentEvent(tx, {
    shipmentId: shipment.id,
    actorUserId: input.actorUserId,
    type: "CREATED",
    toStatus: "PREPARING",
    expectedDeliveryAt: input.expectedDeliveryAt,
    reason: `تم إنشاء الشحنة لطلب العميل ${order.orderNumber}.`,
  });
  return shipment;
}

export async function markShipmentReadyInTransaction(
  tx: TransactionClient,
  id: string,
  actorUserId: string,
  now = new Date(),
) {
  const shipment = await lockShipmentAndRun(tx, id);
  if (shipment.status !== "PREPARING") {
    throw new DeliveryOperationError("يمكن تجهيز الشحنة قيد التجهيز فقط.");
  }
  const updated = await tx.deliveryShipment.updateMany({
    where: { id, status: "PREPARING" },
    data: { status: "READY_FOR_DISPATCH", readyAt: now },
  });
  if (updated.count !== 1) {
    throw new DeliveryOperationError("تغيرت حالة الشحنة. حدّث الصفحة وحاول مجددًا.");
  }
  await recordShipmentEvent(tx, {
    shipmentId: id,
    actorUserId,
    type: "STATUS_CHANGED",
    fromStatus: "PREPARING",
    toStatus: "READY_FOR_DISPATCH",
  });
}

export async function assignShipmentToRunInTransaction(
  tx: TransactionClient,
  shipmentId: string,
  runId: string,
  actorUserId: string,
) {
  await lockRun(tx, runId);
  await lockShipment(tx, shipmentId);
  const [run, shipment] = await Promise.all([
    tx.deliveryRun.findUnique({
      where: { id: runId },
      include: {
        driver: { select: { isActive: true } },
        vehicle: { select: { isActive: true, maxStops: true } },
      },
    }),
    tx.deliveryShipment.findUnique({ where: { id: shipmentId } }),
  ]);
  if (!run || !shipment) {
    throw new DeliveryOperationError("تعذّر العثور على المسار أو الشحنة.");
  }
  if (run.status !== "PLANNED") {
    throw new DeliveryOperationError("يمكن تعديل المسار المخطط فقط.");
  }
  if (!run.driver.isActive || !run.vehicle.isActive) {
    throw new DeliveryOperationError("السائق أو المركبة غير نشطين.");
  }
  if (shipment.status !== "READY_FOR_DISPATCH") {
    throw new DeliveryOperationError("جهّز الشحنة قبل إسنادها إلى مسار.");
  }
  if (shipment.runId) {
    throw new DeliveryOperationError("الشحنة مسندة بالفعل إلى مسار.");
  }
  if (run.region.trim().toLocaleLowerCase("ar") !==
      shipment.region.trim().toLocaleLowerCase("ar")) {
    throw new DeliveryOperationError("يجب أن تطابق منطقة الشحنة منطقة المسار.");
  }
  const runDay = deliveryDayRange(run.scheduledAt);
  const shipmentDay = deliveryDayRange(shipment.expectedDeliveryAt);
  if (runDay.start.getTime() !== shipmentDay.start.getTime()) {
    throw new DeliveryOperationError("يجب أن يطابق تاريخ المسار موعد الشحنة المتوقع.");
  }
  const stopCount = await tx.deliveryShipment.count({
    where: { runId },
  });
  if (stopCount >= run.vehicle.maxStops) {
    throw new DeliveryOperationError("تجاوز المسار سعة التوقفات للمركبة.");
  }

  await tx.deliveryShipment.update({
    where: { id: shipmentId },
    data: { runId },
  });
  await recordShipmentEvent(tx, {
    shipmentId,
    actorUserId,
    type: "ASSIGNED_TO_RUN",
    fromStatus: shipment.status,
    toStatus: shipment.status,
    runId,
    reason: `إسناد إلى المسار ${run.runNumber}.`,
  });
}

export async function createDeliveryRunInTransaction(
  tx: TransactionClient,
  input: {
    region: string;
    priority: DeliveryPriority;
    scheduledAt: Date;
    driverId: string;
    vehicleId: string;
    actorUserId: string;
  },
  now = new Date(),
) {
  const driverRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DeliveryDriver" WHERE "id" = ${input.driverId} FOR UPDATE
  `;
  const vehicleRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DeliveryVehicle" WHERE "id" = ${input.vehicleId} FOR UPDATE
  `;
  if (driverRows.length === 0 || vehicleRows.length === 0) {
    throw new DeliveryOperationError("السائق أو المركبة غير موجودين.");
  }

  const [driver, vehicle] = await Promise.all([
    tx.deliveryDriver.findUnique({
      where: { id: input.driverId },
      select: { isActive: true },
    }),
    tx.deliveryVehicle.findUnique({
      where: { id: input.vehicleId },
      select: { isActive: true },
    }),
  ]);
  if (!driver?.isActive || !vehicle?.isActive) {
    throw new DeliveryOperationError("اختر سائقًا ومركبة نشطين.");
  }

  const { start, end } = deliveryDayRange(input.scheduledAt);
  const conflictingRun = await tx.deliveryRun.findFirst({
    where: {
      scheduledAt: { gte: start, lt: end },
      status: { in: ["PLANNED", "DISPATCHED"] },
      OR: [{ driverId: input.driverId }, { vehicleId: input.vehicleId }],
    },
    select: { runNumber: true },
  });
  if (conflictingRun) {
    throw new DeliveryOperationError(
      `السائق أو المركبة مرتبطان بالفعل بالمسار ${conflictingRun.runNumber} في هذا اليوم.`,
    );
  }

  const [sequence] = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT nextval('"DeliveryRun_runNumber_seq"')::text AS value
  `;
  if (!sequence) throw new Error("Delivery run sequence returned no value");
  const run = await tx.deliveryRun.create({
    data: {
      runNumber: `RUN-${currentYear(now)}-${sequence.value.padStart(6, "0")}`,
      region: input.region.trim(),
      priority: input.priority,
      scheduledAt: input.scheduledAt,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      createdByUserId: input.actorUserId,
    },
    select: { id: true, runNumber: true },
  });
  return run;
}

export async function dispatchDeliveryRunInTransaction(
  tx: TransactionClient,
  id: string,
  actorUserId: string,
  now = new Date(),
) {
  await lockRun(tx, id);
  const run = await tx.deliveryRun.findUnique({
    where: { id },
    include: {
      driver: { select: { isActive: true } },
      vehicle: { select: { isActive: true, maxStops: true } },
      shipments: { select: { id: true, status: true } },
    },
  });
  if (!run) throw new DeliveryOperationError("مسار التوصيل غير موجود.");
  if (run.status !== "PLANNED") {
    throw new DeliveryOperationError("يمكن إرسال المسارات المخططة فقط.");
  }
  if (!run.driver.isActive || !run.vehicle.isActive) {
    throw new DeliveryOperationError("السائق أو المركبة غير نشطين.");
  }
  if (run.shipments.length === 0) {
    throw new DeliveryOperationError("أضف شحنة واحدة على الأقل قبل الإرسال.");
  }
  if (run.shipments.length > run.vehicle.maxStops) {
    throw new DeliveryOperationError("تجاوز المسار سعة التوقفات للمركبة.");
  }
  if (run.shipments.some((shipment) => shipment.status !== "READY_FOR_DISPATCH")) {
    throw new DeliveryOperationError("كل الشحنات في المسار يجب أن تكون جاهزة للإرسال.");
  }
  for (const shipment of [...run.shipments].sort((a, b) => a.id.localeCompare(b.id))) {
    await lockShipment(tx, shipment.id);
  }

  const updatedRun = await tx.deliveryRun.updateMany({
    where: { id, status: "PLANNED" },
    data: { status: "DISPATCHED", dispatchedAt: now },
  });
  if (updatedRun.count !== 1) {
    throw new DeliveryOperationError("تغيرت حالة المسار. حدّث الصفحة وحاول مجددًا.");
  }
  for (const shipment of run.shipments) {
    const updated = await tx.deliveryShipment.updateMany({
      where: { id: shipment.id, runId: id, status: "READY_FOR_DISPATCH" },
      data: { status: "DISPATCHED", dispatchedAt: now },
    });
    if (updated.count !== 1) {
      throw new DeliveryOperationError("تغيرت حالة إحدى الشحنات. حدّث الصفحة.");
    }
    await recordShipmentEvent(tx, {
      shipmentId: shipment.id,
      actorUserId,
      type: "RUN_DISPATCHED",
      fromStatus: "READY_FOR_DISPATCH",
      toStatus: "DISPATCHED",
      runId: id,
      reason: `تم إرسال المسار ${run.runNumber}.`,
    });
  }
}

async function completeRunIfSettled(
  tx: TransactionClient,
  runId: string | null,
  now: Date,
) {
  if (!runId) return;
  const remaining = await tx.deliveryShipment.count({
    where: {
      runId,
      status: { notIn: ["DELIVERED", "DELIVERY_FAILED"] },
    },
  });
  if (remaining === 0) {
    await tx.deliveryRun.updateMany({
      where: { id: runId, status: "DISPATCHED" },
      data: { status: "COMPLETED", completedAt: now },
    });
  }
}

export async function startShipmentTransitInTransaction(
  tx: TransactionClient,
  id: string,
  actorUserId: string,
  now = new Date(),
) {
  const shipment = await lockShipmentAndRun(tx, id);
  if (shipment.status !== "DISPATCHED") {
    throw new DeliveryOperationError("يمكن بدء التوصيل للشحنات المرسلة فقط.");
  }
  const updated = await tx.deliveryShipment.updateMany({
    where: { id, status: "DISPATCHED" },
    data: { status: "IN_TRANSIT", inTransitAt: now },
  });
  if (updated.count !== 1) {
    throw new DeliveryOperationError("تغيرت حالة الشحنة. حدّث الصفحة وحاول مجددًا.");
  }
  await recordShipmentEvent(tx, {
    shipmentId: id,
    actorUserId,
    type: "STATUS_CHANGED",
    fromStatus: "DISPATCHED",
    toStatus: "IN_TRANSIT",
    runId: shipment.runId,
  });
}

export async function confirmShipmentDeliveryInTransaction(
  tx: TransactionClient,
  id: string,
  actorUserId: string,
  receiverName: string,
  notes: string | null,
  now = new Date(),
) {
  const shipment = await lockShipmentAndRun(tx, id);
  if (shipment.status !== "IN_TRANSIT") {
    throw new DeliveryOperationError("يمكن تأكيد استلام الشحنة أثناء التوصيل فقط.");
  }
  const receiver = receiverName.trim();
  if (!receiver || receiver.length > 160) {
    throw new DeliveryOperationError("أدخل اسم مستلم صالحًا لا يتجاوز 160 حرفًا.");
  }
  const updated = await tx.deliveryShipment.updateMany({
    where: { id, status: "IN_TRANSIT" },
    data: {
      status: "DELIVERED",
      receiverName: receiver,
      deliveredAt: now,
      notes: notes ?? shipment.notes,
    },
  });
  if (updated.count !== 1) {
    throw new DeliveryOperationError("تغيرت حالة الشحنة. حدّث الصفحة وحاول مجددًا.");
  }
  await recordShipmentEvent(tx, {
    shipmentId: id,
    actorUserId,
    type: "STATUS_CHANGED",
    fromStatus: "IN_TRANSIT",
    toStatus: "DELIVERED",
    runId: shipment.runId,
    receiverName: receiver,
    reason: notes,
  });
  await completeRunIfSettled(tx, shipment.runId, now);
}

export async function failShipmentDeliveryInTransaction(
  tx: TransactionClient,
  id: string,
  actorUserId: string,
  reason: string,
  now = new Date(),
) {
  const shipment = await lockShipmentAndRun(tx, id);
  if (shipment.status !== "IN_TRANSIT") {
    throw new DeliveryOperationError("يمكن تسجيل تعذّر التوصيل أثناء وجود الشحنة بالطريق فقط.");
  }
  const failureReason = reason.trim();
  if (failureReason.length < 3 || failureReason.length > 1000) {
    throw new DeliveryOperationError("أدخل سببًا صالحًا لتعذّر التوصيل.");
  }
  const updated = await tx.deliveryShipment.updateMany({
    where: { id, status: "IN_TRANSIT" },
    data: {
      status: "DELIVERY_FAILED",
      failedAt: now,
      failedReason: failureReason,
    },
  });
  if (updated.count !== 1) {
    throw new DeliveryOperationError("تغيرت حالة الشحنة. حدّث الصفحة وحاول مجددًا.");
  }
  await recordShipmentEvent(tx, {
    shipmentId: id,
    actorUserId,
    type: "STATUS_CHANGED",
    fromStatus: "IN_TRANSIT",
    toStatus: "DELIVERY_FAILED",
    runId: shipment.runId,
    reason: failureReason,
  });
  await completeRunIfSettled(tx, shipment.runId, now);
}

export async function rescheduleFailedShipmentInTransaction(
  tx: TransactionClient,
  id: string,
  actorUserId: string,
  expectedDeliveryAt: Date,
  now = new Date(),
) {
  const shipment = await lockShipmentAndRun(tx, id);
  if (shipment.status !== "DELIVERY_FAILED") {
    throw new DeliveryOperationError("يمكن إعادة جدولة الشحنات التي تعذّر توصيلها فقط.");
  }
  if (expectedDeliveryAt.getTime() <= now.getTime()) {
    throw new DeliveryOperationError("يجب تحديد موعد مستقبلي لإعادة التوصيل.");
  }
  const updated = await tx.deliveryShipment.updateMany({
    where: { id, status: "DELIVERY_FAILED" },
    data: {
      status: "READY_FOR_DISPATCH",
      expectedDeliveryAt,
      readyAt: now,
      failedAt: null,
      failedReason: null,
      runId: null,
    },
  });
  if (updated.count !== 1) {
    throw new DeliveryOperationError("تغيرت حالة الشحنة. حدّث الصفحة وحاول مجددًا.");
  }
  await recordShipmentEvent(tx, {
    shipmentId: id,
    actorUserId,
    type: "RESCHEDULED",
    fromStatus: "DELIVERY_FAILED",
    toStatus: "READY_FOR_DISPATCH",
    runId: shipment.runId,
    expectedDeliveryAt,
    reason: shipment.failedReason,
  });
  await completeRunIfSettled(tx, shipment.runId, now);
}

export async function setDriverActiveInTransaction(
  tx: TransactionClient,
  id: string,
  isActive: boolean,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DeliveryDriver" WHERE "id" = ${id} FOR UPDATE
  `;
  if (rows.length === 0) throw new DeliveryOperationError("السائق غير موجود.");
  if (!isActive) {
    const activeRun = await tx.deliveryRun.findFirst({
      where: { driverId: id, status: { in: ["PLANNED", "DISPATCHED"] } },
      select: { runNumber: true },
    });
    if (activeRun) {
      throw new DeliveryOperationError(
        `لا يمكن إيقاف السائق قبل إغلاق المسار ${activeRun.runNumber}.`,
      );
    }
  }
  await tx.deliveryDriver.update({ where: { id }, data: { isActive } });
}

export async function setVehicleActiveInTransaction(
  tx: TransactionClient,
  id: string,
  isActive: boolean,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DeliveryVehicle" WHERE "id" = ${id} FOR UPDATE
  `;
  if (rows.length === 0) throw new DeliveryOperationError("المركبة غير موجودة.");
  if (!isActive) {
    const activeRun = await tx.deliveryRun.findFirst({
      where: { vehicleId: id, status: { in: ["PLANNED", "DISPATCHED"] } },
      select: { runNumber: true },
    });
    if (activeRun) {
      throw new DeliveryOperationError(
        `لا يمكن إيقاف المركبة قبل إغلاق المسار ${activeRun.runNumber}.`,
      );
    }
  }
  await tx.deliveryVehicle.update({ where: { id }, data: { isActive } });
}

export async function cancelDeliveryRunInTransaction(
  tx: TransactionClient,
  id: string,
) {
  await lockRun(tx, id);
  const run = await tx.deliveryRun.findUnique({
    where: { id },
    select: { status: true, _count: { select: { shipments: true } } },
  });
  if (!run) throw new DeliveryOperationError("مسار التوصيل غير موجود.");
  if (run.status !== "PLANNED" || run._count.shipments > 0) {
    throw new DeliveryOperationError(
      "يمكن إلغاء المسارات المخططة الخالية من الشحنات فقط.",
    );
  }
  await tx.deliveryRun.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}

export type CreateDeliveryRunInput = {
  region: string;
  priority: DeliveryPriority;
  scheduledAt: Date;
  driverId: string;
  vehicleId: string;
  actorUserId: string;
};

export type CreateVehicleInput = {
  plate: string;
  label: string;
  type: DeliveryVehicleType;
  maxStops: number;
};

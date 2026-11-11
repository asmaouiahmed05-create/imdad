export const DELIVERY_SHIPMENT_STATUSES = [
  "PREPARING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "DELIVERY_FAILED",
] as const;

export type DeliveryShipmentStatus =
  (typeof DELIVERY_SHIPMENT_STATUSES)[number];

export const DELIVERY_RUN_STATUSES = [
  "PLANNED",
  "DISPATCHED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type DeliveryRunStatus = (typeof DELIVERY_RUN_STATUSES)[number];

export const DELIVERY_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
] as const;

export type DeliveryPriority = (typeof DELIVERY_PRIORITIES)[number];

export const DELIVERY_VEHICLE_TYPES = [
  "VAN",
  "TRUCK",
  "REFRIGERATED",
  "OTHER",
] as const;

export type DeliveryVehicleType = (typeof DELIVERY_VEHICLE_TYPES)[number];

export const DELIVERY_SHIPMENT_STATUS_LABELS: Record<
  DeliveryShipmentStatus,
  string
> = {
  PREPARING: "قيد التجهيز",
  READY_FOR_DISPATCH: "جاهز للإرسال",
  DISPATCHED: "تم الإرسال",
  IN_TRANSIT: "قيد التوصيل",
  DELIVERED: "تم التسليم",
  DELIVERY_FAILED: "تعذّر التسليم",
};

export const DELIVERY_SHIPMENT_STATUS_CLASSES: Record<
  DeliveryShipmentStatus,
  string
> = {
  PREPARING: "border-amber-400/20 bg-amber-400/[0.06] text-amber-200",
  READY_FOR_DISPATCH: "border-sky-400/20 bg-sky-400/[0.06] text-sky-200",
  DISPATCHED: "border-indigo-400/20 bg-indigo-400/[0.06] text-indigo-200",
  IN_TRANSIT: "border-blue-400/20 bg-blue-400/[0.06] text-blue-200",
  DELIVERED: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200",
  DELIVERY_FAILED: "border-rose-400/20 bg-rose-400/[0.06] text-rose-200",
};

export const DELIVERY_RUN_STATUS_LABELS: Record<DeliveryRunStatus, string> = {
  PLANNED: "مخطط",
  DISPATCHED: "تم الإرسال",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

export const DELIVERY_PRIORITY_LABELS: Record<DeliveryPriority, string> = {
  LOW: "منخفضة",
  NORMAL: "عادية",
  HIGH: "مرتفعة",
  URGENT: "عاجلة",
};

export const DELIVERY_VEHICLE_TYPE_LABELS: Record<
  DeliveryVehicleType,
  string
> = {
  VAN: "شاحنة صغيرة",
  TRUCK: "شاحنة",
  REFRIGERATED: "مركبة مبردة",
  OTHER: "أخرى",
};

export function isDeliveryShipmentStatus(
  value: unknown,
): value is DeliveryShipmentStatus {
  return (
    typeof value === "string" &&
    (DELIVERY_SHIPMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isDeliveryPriority(value: unknown): value is DeliveryPriority {
  return (
    typeof value === "string" &&
    (DELIVERY_PRIORITIES as readonly string[]).includes(value)
  );
}

export function isDeliveryVehicleType(
  value: unknown,
): value is DeliveryVehicleType {
  return (
    typeof value === "string" &&
    (DELIVERY_VEHICLE_TYPES as readonly string[]).includes(value)
  );
}

export function parseDeliveryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T12:00:00+01:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" }) ===
    value
    ? date
    : null;
}

export function deliveryDayRange(date: Date) {
  const day = date.toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
  const start = new Date(`${day}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function validateShipmentInput(input: {
  orderId: string;
  address: string;
  region: string;
  expectedDeliveryDate: string;
  notes: string;
}) {
  if (!input.orderId.trim()) return "اختر طلبًا مكتملًا.";
  if (!input.address.trim() || input.address.trim().length > 300) {
    return "أدخل عنوانًا صالحًا لا يتجاوز 300 حرف.";
  }
  if (!input.region.trim() || input.region.trim().length > 120) {
    return "أدخل منطقة صالحة لا تتجاوز 120 حرفًا.";
  }
  if (!parseDeliveryDate(input.expectedDeliveryDate)) {
    return "أدخل تاريخ توصيل صالحًا.";
  }
  if (input.notes.length > 2000) {
    return "يجب ألا تتجاوز الملاحظات 2000 حرف.";
  }
  return null;
}

export function validateRunInput(input: {
  region: string;
  scheduledDate: string;
  priority: string;
  driverId: string;
  vehicleId: string;
}) {
  if (!input.region.trim() || input.region.trim().length > 120) {
    return "أدخل منطقة صالحة لا تتجاوز 120 حرفًا.";
  }
  if (!parseDeliveryDate(input.scheduledDate)) {
    return "أدخل تاريخًا صالحًا للمسار.";
  }
  if (!isDeliveryPriority(input.priority)) return "اختر أولوية صالحة.";
  if (!input.driverId.trim()) return "اختر سائقًا.";
  if (!input.vehicleId.trim()) return "اختر مركبة.";
  return null;
}

export function validateDriverInput(input: { name: string; phone: string }) {
  if (!input.name.trim() || input.name.trim().length > 160) {
    return "أدخل اسم سائق صالحًا لا يتجاوز 160 حرفًا.";
  }
  if (!input.phone.trim() || input.phone.trim().length > 40) {
    return "أدخل رقم هاتف صالحًا لا يتجاوز 40 حرفًا.";
  }
  return null;
}

export function validateVehicleInput(input: {
  plate: string;
  label: string;
  type: string;
  maxStops: number;
}) {
  if (!input.plate.trim() || input.plate.trim().length > 40) {
    return "أدخل رقم لوحة صالحًا لا يتجاوز 40 حرفًا.";
  }
  if (!input.label.trim() || input.label.trim().length > 120) {
    return "أدخل وصفًا صالحًا للمركبة لا يتجاوز 120 حرفًا.";
  }
  if (!isDeliveryVehicleType(input.type)) return "اختر نوع مركبة صالحًا.";
  if (!Number.isInteger(input.maxStops) || input.maxStops < 1 || input.maxStops > 200) {
    return "يجب أن تتراوح سعة التوقفات بين 1 و200.";
  }
  return null;
}

export function canTransitionShipment(
  current: DeliveryShipmentStatus,
  next: DeliveryShipmentStatus,
) {
  return (
    (current === "PREPARING" && next === "READY_FOR_DISPATCH") ||
    (current === "DISPATCHED" && next === "IN_TRANSIT") ||
    (current === "IN_TRANSIT" &&
      (next === "DELIVERED" || next === "DELIVERY_FAILED")) ||
    (current === "DELIVERY_FAILED" && next === "READY_FOR_DISPATCH")
  );
}

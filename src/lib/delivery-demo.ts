import {
  DEMO_CUSTOMERS,
  type SalesOrder,
} from "./sales-demo.ts";

export const DELIVERY_DEMO_STORAGE_KEY = "imdad-deliveries-demo-v1";

export const DEMO_DRIVERS = [
  { id: "driver-yacine", name: "ياسين بن عمر", phone: "+213 550 12 34 56" },
  { id: "driver-samira", name: "سميرة قادري", phone: "+213 661 23 45 67" },
  { id: "driver-karim", name: "كريم بوعلام", phone: "+213 770 34 56 78" },
  { id: "driver-nadia", name: "نادية مراد", phone: "+213 555 45 67 89" },
] as const;

export const DEMO_DELIVERY_ADDRESSES: Record<string, string> = {
  "customer-alger-centre": "شارع ديدوش مراد، ساحة أودان، الجزائر العاصمة",
  "customer-oran": "شارع العربي بن مهيدي، حي الصديقية، وهران",
  "customer-constantine": "شارع عبان رمضان، وسط المدينة، قسنطينة",
  "customer-setif": "شارع أول نوفمبر، وسط المدينة، سطيف",
  "customer-blida": "شارع محمد بوضياف، حي بن بولعيد، البليدة",
};

export const DELIVERY_STATUSES = [
  "PENDING",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type DeliveryRecord = {
  id: string;
  reference: string;
  orderId: string;
  customerId: string;
  address: string;
  deliveryDate: string;
  driverId: string;
  notes: string;
  status: DeliveryStatus;
  createdAt: string;
};

export type DeliveryInput = Omit<
  DeliveryRecord,
  "id" | "reference" | "customerId" | "status" | "createdAt"
>;

const initialDemoDeliveries: DeliveryRecord[] = [
  {
    id: "demo-delivery-001",
    reference: "DLV-2026-001",
    orderId: "demo-sales-002",
    customerId: "customer-oran",
    address: "شارع العربي بن مهيدي، حي الصديقية، وهران",
    deliveryDate: "2026-11-07",
    driverId: "driver-yacine",
    notes: "الاتصال بالعميل قبل الوصول.",
    status: "PENDING",
    createdAt: "2026-10-29T09:00:00.000Z",
  },
];

export function getInitialDemoDeliveries(): DeliveryRecord[] {
  return initialDemoDeliveries.map((delivery) => ({ ...delivery }));
}

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return (
    typeof value === "string" &&
    (DELIVERY_STATUSES as readonly string[]).includes(value)
  );
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  if (!value || typeof value !== "object") return false;
  const delivery = value as Record<string, unknown>;
  return (
    typeof delivery.id === "string" &&
    typeof delivery.reference === "string" &&
    typeof delivery.orderId === "string" &&
    typeof delivery.customerId === "string" &&
    DEMO_CUSTOMERS.some((customer) => customer.id === delivery.customerId) &&
    typeof delivery.address === "string" &&
    delivery.address.trim().length > 0 &&
    delivery.address.length <= 300 &&
    typeof delivery.deliveryDate === "string" &&
    isValidDate(delivery.deliveryDate) &&
    typeof delivery.driverId === "string" &&
    DEMO_DRIVERS.some((driver) => driver.id === delivery.driverId) &&
    typeof delivery.notes === "string" &&
    delivery.notes.length <= 2000 &&
    isDeliveryStatus(delivery.status) &&
    typeof delivery.createdAt === "string"
  );
}

export function canCreateDelivery(order: SalesOrder) {
  return order.status === "CONFIRMED" || order.status === "READY";
}

export function validateDelivery(
  input: DeliveryInput,
  orders: readonly SalesOrder[],
  deliveries: readonly DeliveryRecord[],
) {
  const order = orders.find((candidate) => candidate.id === input.orderId);
  if (!order) return "اختر طلب عميل موجودًا.";
  if (!canCreateDelivery(order)) {
    return "يمكن إنشاء سجل تسليم للطلبات المؤكدة أو الجاهزة للتسليم فقط.";
  }
  if (deliveries.some((delivery) => delivery.orderId === order.id)) {
    return "يوجد سجل تسليم مرتبط بهذا الطلب بالفعل.";
  }
  if (typeof input.address !== "string" || !input.address.trim()) {
    return "أدخل عنوان التسليم.";
  }
  if (input.address.trim().length > 300) {
    return "يجب ألا يتجاوز عنوان التسليم 300 حرف.";
  }
  if (!isValidDate(input.deliveryDate)) {
    return "أدخل تاريخ تسليم صالحًا.";
  }
  if (!DEMO_DRIVERS.some((driver) => driver.id === input.driverId)) {
    return "اختر سائقًا تجريبيًا من القائمة.";
  }
  if (input.notes.length > 2000) {
    return "يجب ألا تتجاوز ملاحظات التسليم 2000 حرف.";
  }
  return null;
}

export function createDelivery(
  input: DeliveryInput,
  orders: readonly SalesOrder[],
  deliveries: readonly DeliveryRecord[],
  now = new Date(),
  id = `demo-delivery-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
): DeliveryRecord {
  const validationError = validateDelivery(input, orders, deliveries);
  if (validationError) throw new Error(validationError);

  const order = orders.find((candidate) => candidate.id === input.orderId);
  if (!order) throw new Error("طلب العميل غير موجود.");
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  }).format(now);
  const sequence = deliveries.reduce((maximum, delivery) => {
    const match = /^DLV-(\d{4})-(\d+)$/u.exec(delivery.reference);
    return match?.[1] === year ? Math.max(maximum, Number(match[2])) : maximum;
  }, 0);

  return {
    ...input,
    id,
    reference: `DLV-${year}-${String(sequence + 1).padStart(3, "0")}`,
    customerId: order.customerId,
    address: input.address.trim(),
    notes: input.notes.trim(),
    status: "PENDING",
    createdAt: now.toISOString(),
  };
}

export function getNextDeliveryStatus(
  status: DeliveryStatus,
): DeliveryStatus | null {
  switch (status) {
    case "PENDING":
      return "PREPARING";
    case "PREPARING":
      return "OUT_FOR_DELIVERY";
    case "OUT_FOR_DELIVERY":
      return "DELIVERED";
    case "DELIVERED":
    case "FAILED":
      return null;
  }
}

export function canTransitionDeliveryStatus(
  current: DeliveryStatus,
  next: DeliveryStatus,
) {
  return (
    getNextDeliveryStatus(current) === next ||
    (next === "FAILED" &&
      current !== "DELIVERED" &&
      current !== "FAILED")
  );
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "قيد الانتظار",
  PREPARING: "قيد التجهيز",
  OUT_FOR_DELIVERY: "خرج للتوصيل",
  DELIVERED: "تم التسليم",
  FAILED: "تعذّر التسليم",
};

export const DELIVERY_STATUS_CLASSES: Record<DeliveryStatus, string> = {
  PENDING: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  PREPARING: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  OUT_FOR_DELIVERY: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  DELIVERED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  FAILED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

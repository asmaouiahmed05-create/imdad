import { DEMO_PRODUCTS } from "./production-demo.ts";

export const SALES_DEMO_STORAGE_KEY = "imdad-sales-orders-demo-v1";

export const DEMO_CUSTOMERS = [
  {
    id: "customer-alger-centre",
    name: "شركة الأفق للتجهيزات",
    city: "الجزائر العاصمة",
    phone: "+213 21 55 18 42",
    email: "achats@alofok.example",
  },
  {
    id: "customer-oran",
    name: "مؤسسة وهران للأعمال",
    city: "وهران",
    phone: "+213 41 32 67 10",
    email: "contact@oran-business.example",
  },
  {
    id: "customer-constantine",
    name: "شركة الجسور الحديثة",
    city: "قسنطينة",
    phone: "+213 31 74 20 85",
    email: "achats@modern-bridges.example",
  },
  {
    id: "customer-setif",
    name: "مؤسسة الهضاب للتجارة",
    city: "سطيف",
    phone: "+213 36 91 44 26",
    email: "orders@highlands.example",
  },
  {
    id: "customer-blida",
    name: "مركز البليدة للخدمات",
    city: "البليدة",
    phone: "+213 25 40 73 19",
    email: "admin@blida-services.example",
  },
] as const;

export const SALES_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type SalesStatus = (typeof SALES_STATUSES)[number];

export type SalesOrder = {
  id: string;
  number: string;
  customerId: string;
  product: string;
  quantity: number;
  orderDate: string;
  expectedDeliveryDate: string;
  notes: string;
  status: SalesStatus;
  createdAt: string;
};

export type SalesOrderInput = Omit<
  SalesOrder,
  "id" | "number" | "status" | "createdAt"
>;

const initialDemoOrders: SalesOrder[] = [
  {
    id: "demo-sales-001",
    number: "ORD-2026-001",
    customerId: "customer-alger-centre",
    product: "كرسي مكتبي",
    quantity: 24,
    orderDate: "2026-10-25",
    expectedDeliveryDate: "2026-11-05",
    notes: "تجهيز لمكاتب الطابق الجديد.",
    status: "NEW",
    createdAt: "2026-10-25T09:00:00.000Z",
  },
  {
    id: "demo-sales-002",
    number: "ORD-2026-002",
    customerId: "customer-oran",
    product: "طاولة اجتماعات",
    quantity: 6,
    orderDate: "2026-10-24",
    expectedDeliveryDate: "2026-11-07",
    notes: "مقاس موحد للقاعة الرئيسية.",
    status: "CONFIRMED",
    createdAt: "2026-10-24T11:15:00.000Z",
  },
  {
    id: "demo-sales-003",
    number: "ORD-2026-003",
    customerId: "customer-constantine",
    product: "رف تخزين معدني",
    quantity: 18,
    orderDate: "2026-10-22",
    expectedDeliveryDate: "2026-11-08",
    notes: "",
    status: "PREPARING",
    createdAt: "2026-10-22T08:30:00.000Z",
  },
  {
    id: "demo-sales-004",
    number: "ORD-2026-004",
    customerId: "customer-setif",
    product: "خزانة ملفات",
    quantity: 10,
    orderDate: "2026-10-18",
    expectedDeliveryDate: "2026-10-30",
    notes: "التسليم إلى مكتب الاستقبال.",
    status: "READY",
    createdAt: "2026-10-18T13:45:00.000Z",
  },
  {
    id: "demo-sales-005",
    number: "ORD-2026-005",
    customerId: "customer-blida",
    product: "كرسي مكتبي",
    quantity: 12,
    orderDate: "2026-10-12",
    expectedDeliveryDate: "2026-10-27",
    notes: "",
    status: "DELIVERED",
    createdAt: "2026-10-12T10:00:00.000Z",
  },
  {
    id: "demo-sales-006",
    number: "ORD-2026-006",
    customerId: "customer-oran",
    product: "خزانة ملفات",
    quantity: 3,
    orderDate: "2026-10-10",
    expectedDeliveryDate: "2026-10-25",
    notes: "أُلغي الطلب التجريبي.",
    status: "CANCELLED",
    createdAt: "2026-10-10T14:20:00.000Z",
  },
];

export function getInitialSalesOrders(): SalesOrder[] {
  return initialDemoOrders.map((order) => ({ ...order }));
}

export function isSalesStatus(value: unknown): value is SalesStatus {
  return (
    typeof value === "string" &&
    (SALES_STATUSES as readonly string[]).includes(value)
  );
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isSalesOrder(value: unknown): value is SalesOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return (
    typeof order.id === "string" &&
    typeof order.number === "string" &&
    typeof order.customerId === "string" &&
    DEMO_CUSTOMERS.some((customer) => customer.id === order.customerId) &&
    typeof order.product === "string" &&
    (DEMO_PRODUCTS as readonly string[]).includes(order.product) &&
    typeof order.quantity === "number" &&
    Number.isSafeInteger(order.quantity) &&
    order.quantity > 0 &&
    isValidDate(String(order.orderDate)) &&
    isValidDate(String(order.expectedDeliveryDate)) &&
    typeof order.notes === "string" &&
    isSalesStatus(order.status) &&
    typeof order.createdAt === "string"
  );
}

export function parseSalesQuantity(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 1_000_000
    ? quantity
    : null;
}

export function validateSalesOrder(input: SalesOrderInput) {
  if (!DEMO_CUSTOMERS.some((customer) => customer.id === input.customerId)) {
    return "اختر عميلًا من القائمة.";
  }
  if (!(DEMO_PRODUCTS as readonly string[]).includes(input.product)) {
    return "اختر منتجًا من القائمة.";
  }
  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity <= 0 ||
    input.quantity > 1_000_000
  ) {
    return "أدخل كمية صحيحة أكبر من صفر وبحد أقصى مليون قطعة.";
  }
  if (!isValidDate(input.orderDate)) return "أدخل تاريخ طلب صالحًا.";
  if (!isValidDate(input.expectedDeliveryDate)) {
    return "أدخل تاريخ تسليم متوقع صالحًا.";
  }
  if (input.expectedDeliveryDate < input.orderDate) {
    return "يجب ألا يسبق تاريخ التسليم المتوقع تاريخ الطلب.";
  }
  if (input.notes.length > 2000) return "يجب ألا تتجاوز الملاحظات 2000 حرف.";
  return null;
}

export function createSalesOrder(
  input: SalesOrderInput,
  orders: readonly SalesOrder[],
  now = new Date(),
  id = `demo-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
): SalesOrder {
  const validationError = validateSalesOrder(input);
  if (validationError) throw new Error(validationError);

  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  }).format(now);
  const sequence = orders.reduce((maximum, order) => {
    const match = /^ORD-(\d{4})-(\d+)$/u.exec(order.number);
    return match?.[1] === year ? Math.max(maximum, Number(match[2])) : maximum;
  }, 0);

  return {
    ...input,
    id,
    number: `ORD-${year}-${String(sequence + 1).padStart(3, "0")}`,
    status: "NEW",
    createdAt: now.toISOString(),
  };
}

export function getNextSalesStatus(status: SalesStatus): SalesStatus | null {
  switch (status) {
    case "NEW":
      return "CONFIRMED";
    case "CONFIRMED":
      return "PREPARING";
    case "PREPARING":
      return "READY";
    case "READY":
      return "DELIVERED";
    case "DELIVERED":
    case "CANCELLED":
      return null;
  }
}

export function canTransitionSalesStatus(
  current: SalesStatus,
  next: SalesStatus,
) {
  return (
    getNextSalesStatus(current) === next ||
    (next === "CANCELLED" && current !== "DELIVERED" && current !== "CANCELLED")
  );
}

export const SALES_STATUS_LABELS: Record<SalesStatus, string> = {
  NEW: "جديد",
  CONFIRMED: "مؤكد",
  PREPARING: "قيد التحضير",
  READY: "جاهز للتسليم",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

export const SALES_STATUS_CLASSES: Record<SalesStatus, string> = {
  NEW: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  CONFIRMED: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  PREPARING: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  READY: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  DELIVERED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  CANCELLED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

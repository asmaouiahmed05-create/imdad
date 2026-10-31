export const PRODUCTION_DEMO_STORAGE_KEY = "imdad-production-orders-demo-v1";

export const DEMO_PRODUCTS = [
  "كرسي مكتبي",
  "طاولة اجتماعات",
  "رف تخزين معدني",
  "خزانة ملفات",
] as const;

export const PRODUCTION_STATUSES = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export type ProductionOrder = {
  id: string;
  number: string;
  product: string;
  quantity: number;
  plannedStartDate: string;
  expectedCompletionDate: string;
  notes: string;
  status: ProductionStatus;
  createdAt: string;
};

export type ProductionOrderInput = Omit<
  ProductionOrder,
  "id" | "number" | "status" | "createdAt"
>;

const initialDemoOrders: ProductionOrder[] = [
  {
    id: "demo-prd-001",
    number: "PRD-2026-001",
    product: "كرسي مكتبي",
    quantity: 120,
    plannedStartDate: "2026-10-28",
    expectedCompletionDate: "2026-11-04",
    notes: "دفعة تجريبية لعرض سير العمل.",
    status: "IN_PROGRESS",
    createdAt: "2026-10-25T09:00:00.000Z",
  },
  {
    id: "demo-prd-002",
    number: "PRD-2026-002",
    product: "طاولة اجتماعات",
    quantity: 24,
    plannedStartDate: "2026-11-02",
    expectedCompletionDate: "2026-11-10",
    notes: "تجهيز الدفعة الأولى.",
    status: "PLANNED",
    createdAt: "2026-10-26T10:30:00.000Z",
  },
  {
    id: "demo-prd-003",
    number: "PRD-2026-003",
    product: "رف تخزين معدني",
    quantity: 60,
    plannedStartDate: "2026-10-18",
    expectedCompletionDate: "2026-10-27",
    notes: "",
    status: "COMPLETED",
    createdAt: "2026-10-17T08:15:00.000Z",
  },
  {
    id: "demo-prd-004",
    number: "PRD-2026-004",
    product: "خزانة ملفات",
    quantity: 35,
    plannedStartDate: "2026-11-05",
    expectedCompletionDate: "2026-11-14",
    notes: "",
    status: "DRAFT",
    createdAt: "2026-10-30T12:00:00.000Z",
  },
];

export function getInitialDemoOrders(): ProductionOrder[] {
  return initialDemoOrders.map((order) => ({ ...order }));
}

export function isProductionStatus(value: unknown): value is ProductionStatus {
  return (
    typeof value === "string" &&
    (PRODUCTION_STATUSES as readonly string[]).includes(value)
  );
}

export function isProductionOrder(value: unknown): value is ProductionOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return (
    typeof order.id === "string" &&
    typeof order.number === "string" &&
    typeof order.product === "string" &&
    typeof order.quantity === "number" &&
    Number.isFinite(order.quantity) &&
    typeof order.plannedStartDate === "string" &&
    typeof order.expectedCompletionDate === "string" &&
    typeof order.notes === "string" &&
    isProductionStatus(order.status) &&
    typeof order.createdAt === "string"
  );
}

export function parseProductionQuantity(value: string) {
  const normalized = value.trim();
  if (!/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/u.test(normalized)) {
    return null;
  }
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 1_000_000_000
    ? quantity
    : null;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateProductionOrder(input: ProductionOrderInput) {
  if (!(DEMO_PRODUCTS as readonly string[]).includes(input.product)) {
    return "اختر منتجًا من القائمة.";
  }
  if (
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0 ||
    input.quantity > 1_000_000_000 ||
    Math.round(input.quantity * 1_000_000) !== input.quantity * 1_000_000
  ) {
    return "أدخل كمية أكبر من صفر وبحد أقصى ست خانات عشرية.";
  }
  if (!isValidDate(input.plannedStartDate)) {
    return "أدخل تاريخ بدء صالحًا.";
  }
  if (!isValidDate(input.expectedCompletionDate)) {
    return "أدخل تاريخ إنجاز صالحًا.";
  }
  if (input.expectedCompletionDate < input.plannedStartDate) {
    return "يجب ألا يسبق تاريخ الإنجاز تاريخ بدء الإنتاج.";
  }
  if (input.notes.length > 2000) {
    return "يجب ألا تتجاوز الملاحظات 2000 حرف.";
  }
  return null;
}

export function createProductionOrder(
  input: ProductionOrderInput,
  orders: readonly ProductionOrder[],
  now = new Date(),
  id = `demo-${now.getTime()}`,
): ProductionOrder {
  const validationError = validateProductionOrder(input);
  if (validationError) throw new Error(validationError);

  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Africa/Algiers",
  }).format(now);
  const orderSequence = orders.reduce((maximum, order) => {
    const match = /^PRD-(\d{4})-(\d+)$/u.exec(order.number);
    return match?.[1] === year
      ? Math.max(maximum, Number(match[2]))
      : maximum;
  }, 0);

  return {
    ...input,
    id,
    number: `PRD-${year}-${String(orderSequence + 1).padStart(3, "0")}`,
    status: "DRAFT",
    createdAt: now.toISOString(),
  };
}

export function getNextProductionStatus(
  status: ProductionStatus,
): ProductionStatus | null {
  switch (status) {
    case "DRAFT":
      return "PLANNED";
    case "PLANNED":
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "COMPLETED";
    case "COMPLETED":
      return null;
  }
}

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  DRAFT: "مسودة",
  PLANNED: "مخطط",
  IN_PROGRESS: "قيد الإنتاج",
  COMPLETED: "مكتمل",
};

export const PRODUCTION_STATUS_CLASSES: Record<ProductionStatus, string> = {
  DRAFT: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  PLANNED: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  IN_PROGRESS: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  COMPLETED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

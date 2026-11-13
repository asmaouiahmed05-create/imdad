import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AppPermission } from "@/lib/authorization";
import { hasPermission } from "@/lib/authorization";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { createProduct } from "@/app/actions";
import { createSupplier } from "@/app/purchasing-actions";
import { createCustomer } from "@/app/sales/actions";
import { prisma } from "@/lib/db";
import { inventoryStatus, inventoryStatusWhere } from "@/lib/inventory-status";
import { parseInventoryQuantity } from "@/lib/inventory-quantity";
import { isProductionOrderStatus } from "@/lib/production-orders";
import { isCustomerOrderStatus } from "@/lib/sales-order-state";
import {
  DELIVERY_RUN_STATUSES,
  type DeliveryRunStatus,
  isDeliveryShipmentStatus,
} from "@/lib/delivery-state";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";
import type { BillOfMaterialsStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Dataset =
  | "products"
  | "movements"
  | "suppliers"
  | "purchase-orders"
  | "boms"
  | "production-orders"
  | "customers"
  | "customer-orders"
  | "deliveries"
  | "delivery-runs"
  | "fleet"
  | "executive";
type CellValue = string | number | Date | null;
type ExportRow = Record<string, CellValue>;
type Column = { header: string; key: string; width: number; numFmt?: string };

const DATASETS: Record<Dataset, { title: string; permission: AppPermission }> = {
  products: { title: "الأصناف والمخزون", permission: "inventory.read" },
  movements: { title: "حركات المخزون", permission: "inventory.read" },
  suppliers: { title: "الموردون", permission: "supplier.read" },
  "purchase-orders": { title: "أوامر الشراء", permission: "purchase_order.read" },
  boms: { title: "قوائم المواد", permission: "production.bom.read" },
  "production-orders": { title: "أوامر الإنتاج", permission: "production.order.read" },
  customers: { title: "العملاء", permission: "sales.read" },
  "customer-orders": { title: "طلبات العملاء", permission: "sales.read" },
  deliveries: { title: "الشحنات", permission: "distribution.read" },
  "delivery-runs": { title: "مسارات التوصيل", permission: "distribution.read" },
  fleet: { title: "السائقون والمركبات", permission: "distribution.read" },
  executive: { title: "ملخص تنفيذي", permission: "reports.read" },
};

const columns: Record<Dataset, Column[]> = {
  products: [
    { header: "اسم الصنف", key: "name", width: 32 },
    { header: "رمز SKU", key: "sku", width: 20 },
    { header: "الكمية الحالية", key: "quantity", width: 18, numFmt: "#,##0.##" },
    { header: "الوحدة", key: "unit", width: 14 },
    { header: "الحد الأدنى", key: "minQuantity", width: 18, numFmt: "#,##0.##" },
    { header: "التصنيف", key: "classification", width: 20 },
    { header: "الحالة", key: "status", width: 18 },
    { header: "تاريخ الإضافة", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  movements: [
    { header: "التاريخ", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "اسم المنتج", key: "name", width: 30 },
    { header: "رمز SKU", key: "sku", width: 20 },
    { header: "نوع الحركة", key: "type", width: 16 },
    { header: "الكمية", key: "quantity", width: 18, numFmt: "#,##0.##" },
    { header: "الوحدة", key: "unit", width: 14 },
    { header: "السبب", key: "reason", width: 32 },
    { header: "المرجع", key: "reference", width: 24 },
  ],
  suppliers: [
    { header: "اسم المورد", key: "name", width: 30 },
    { header: "جهة الاتصال", key: "contactPerson", width: 24 },
    { header: "الهاتف", key: "phone", width: 20 },
    { header: "البريد الإلكتروني", key: "email", width: 30 },
    { header: "العنوان", key: "address", width: 36 },
    { header: "ملاحظات", key: "notes", width: 40 },
    { header: "الحالة", key: "status", width: 16 },
    { header: "تاريخ الإضافة", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  "purchase-orders": [
    { header: "رقم الأمر", key: "orderNumber", width: 22 },
    { header: "المورد", key: "supplier", width: 30 },
    { header: "الحالة", key: "status", width: 22 },
    { header: "عدد الأصناف", key: "lineCount", width: 16, numFmt: "#,##0" },
    { header: "تفاصيل الأصناف والكميات", key: "lineDetails", width: 54 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "تاريخ الإرسال", key: "submittedAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "تاريخ الاستلام", key: "receivedAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  boms: [
    { header: "المنتج النهائي", key: "product", width: 32 },
    { header: "رمز المنتج", key: "sku", width: 20 },
    { header: "المراجعة", key: "revision", width: 14, numFmt: "#,##0" },
    { header: "عدد المواد", key: "componentCount", width: 16, numFmt: "#,##0" },
    { header: "المواد والكميات لكل وحدة", key: "componentDetails", width: 54 },
    { header: "الحالة", key: "status", width: 18 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  "production-orders": [
    { header: "رقم الأمر", key: "orderNumber", width: 22 },
    { header: "المنتج النهائي", key: "product", width: 32 },
    { header: "المراجعة", key: "revision", width: 14, numFmt: "#,##0" },
    { header: "الكمية المخططة", key: "plannedQuantity", width: 20, numFmt: "#,##0.######" },
    { header: "الكمية المنتجة", key: "producedQuantity", width: 20, numFmt: "#,##0.######" },
    { header: "الحالة", key: "status", width: 18 },
    { header: "تاريخ البدء المخطط", key: "plannedStartDate", width: 22, numFmt: "dd/mm/yyyy" },
    { header: "موعد الإنجاز المتوقع", key: "expectedCompletionDate", width: 22, numFmt: "dd/mm/yyyy" },
    { header: "ملاحظات", key: "notes", width: 40 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  customers: [
    { header: "اسم العميل", key: "name", width: 30 },
    { header: "جهة الاتصال", key: "contactPerson", width: 24 },
    { header: "الهاتف", key: "phone", width: 20 },
    { header: "البريد الإلكتروني", key: "email", width: 30 },
    { header: "المدينة", key: "city", width: 22 },
    { header: "العنوان", key: "address", width: 36 },
    { header: "ملاحظات", key: "notes", width: 40 },
    { header: "الحالة", key: "status", width: 16 },
    { header: "تاريخ الإضافة", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  "customer-orders": [
    { header: "رقم الطلب", key: "orderNumber", width: 22 },
    { header: "العميل", key: "customer", width: 30 },
    { header: "الحالة", key: "status", width: 20 },
    { header: "عدد الأصناف", key: "lineCount", width: 16, numFmt: "#,##0" },
    { header: "تفاصيل الأصناف والكميات", key: "lineDetails", width: 54 },
    { header: "موعد الإنجاز المتوقع", key: "expectedFulfillmentAt", width: 24, numFmt: "dd/mm/yyyy" },
    { header: "ملاحظات", key: "notes", width: 40 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
  ],
  deliveries: [
    { header: "رقم الشحنة", key: "reference", width: 22 },
    { header: "رقم الطلب", key: "orderNumber", width: 22 },
    { header: "العميل", key: "customer", width: 30 },
    { header: "هاتف العميل", key: "customerPhone", width: 20 },
    { header: "المنطقة", key: "region", width: 20 },
    { header: "العنوان", key: "address", width: 38 },
    { header: "موعد التوصيل", key: "expectedDeliveryAt", width: 22, numFmt: "dd/mm/yyyy" },
    { header: "تاريخ التسليم", key: "deliveredAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "ملاحظات", key: "notes", width: 40 },
    { header: "المسار", key: "runNumber", width: 22 },
    { header: "الحالة", key: "status", width: 18 },
  ],
  "delivery-runs": [
    { header: "رقم المسار", key: "runNumber", width: 22 },
    { header: "المنطقة", key: "region", width: 22 },
    { header: "السائق", key: "driver", width: 28 },
    { header: "المركبة", key: "vehicle", width: 22 },
    { header: "موعد الانطلاق", key: "scheduledAt", width: 22, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "عدد الشحنات", key: "shipmentCount", width: 16, numFmt: "#,##0" },
    { header: "الحالة", key: "status", width: 18 },
  ],
  fleet: [
    { header: "نوع السجل", key: "recordType", width: 18 },
    { header: "الاسم / اللوحة", key: "name", width: 30 },
    { header: "التفاصيل", key: "details", width: 30 },
    { header: "الحد الأقصى للتوقفات", key: "maxStops", width: 22, numFmt: "#,##0" },
    { header: "الحالة", key: "status", width: 16 },
  ],
  executive: [
    { header: "المؤشر", key: "metric", width: 34 },
    { header: "القيمة", key: "value", width: 20, numFmt: "#,##0.##" },
  ],
};

type ImportDataset = "products" | "suppliers" | "customers";
type ImportColumn = { key: string; header: string; required?: boolean };
type ImportConfig = {
  permission: AppPermission;
  title: string;
  columns: ImportColumn[];
};
type ImportRow = Record<string, string>;

class ImportFileError extends Error {}
class ExportLimitError extends Error {}

const IMPORTS: Record<ImportDataset, ImportConfig> = {
  products: {
    permission: "product.create",
    title: "استيراد الأصناف",
    columns: [
      { key: "name", header: "اسم المنتج / Product name", required: true },
      { key: "sku", header: "رمز SKU / SKU", required: true },
      { key: "unit", header: "الوحدة / Unit", required: true },
      { key: "quantity", header: "الكمية الابتدائية (0) / Initial quantity (0)", required: true },
      { key: "minQuantity", header: "حد التنبيه / Reorder threshold", required: true },
      { key: "classification", header: "التصنيف / Classification (optional)" },
    ],
  },
  suppliers: {
    permission: "supplier.manage",
    title: "استيراد الموردين",
    columns: [
      { key: "name", header: "اسم المورد / Supplier name", required: true },
      { key: "contactPerson", header: "جهة الاتصال / Contact person" },
      { key: "phone", header: "الهاتف / Phone" },
      { key: "email", header: "البريد الإلكتروني / Email" },
      { key: "address", header: "العنوان / Address" },
      { key: "notes", header: "ملاحظات / Notes" },
    ],
  },
  customers: {
    permission: "sales.customer.manage",
    title: "استيراد العملاء",
    columns: [
      { key: "name", header: "اسم العميل / Customer name", required: true },
      { key: "contactPerson", header: "جهة الاتصال / Contact person" },
      { key: "phone", header: "الهاتف / Phone" },
      { key: "email", header: "البريد الإلكتروني / Email" },
      { key: "city", header: "المدينة / City" },
      { key: "address", header: "العنوان / Address" },
      { key: "notes", header: "ملاحظات / Notes" },
    ],
  },
};

const titleByStatus: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "مرسل",
  PARTIALLY_RECEIVED: "استلام جزئي",
  RECEIVED: "مستلم",
  CANCELLED: "ملغى",
  RELEASED: "معتمد",
  RETIRED: "موقوف",
  IN_PROGRESS: "قيد الإنتاج",
  COMPLETED: "مكتمل",
  PLANNED: "مخطط",
  DISPATCHED: "تم الإرسال",
  DELIVERED: "تم التسليم",
  FAILED: "متعذر",
  PREPARING: "قيد التجهيز",
  READY: "جاهز",
  READY_FOR_DISPATCH: "جاهز للإرسال",
  IN_TRANSIT: "قيد التوصيل",
  DELIVERY_FAILED: "تعذّر التسليم",
  CONFIRMED: "مؤكد",
  FULFILLED: "منفذ",
  normal: "متوفر",
  low: "مخزون منخفض",
  out: "نفد المخزون",
};
const classificationLabels: Record<string, string> = {
  UNCLASSIFIED: "غير مصنف",
  MATERIAL: "مادة أولية",
  FINISHED_GOOD: "منتج نهائي",
  BOTH: "مادة ومنتج نهائي",
};

const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
] as const satisfies readonly PurchaseOrderStatus[];

function isPurchaseOrderStatus(value: string): value is PurchaseOrderStatus {
  return PURCHASE_ORDER_STATUSES.some((candidate) => candidate === value);
}

const BOM_STATUSES = ["DRAFT", "RELEASED", "RETIRED"] as const satisfies readonly BillOfMaterialsStatus[];
function isBomStatus(value: string): value is BillOfMaterialsStatus {
  return BOM_STATUSES.some((candidate) => candidate === value);
}

function isDeliveryRunStatus(value: string): value is DeliveryRunStatus {
  return DELIVERY_RUN_STATUSES.some((candidate) => candidate === value);
}

function filterSummary(params: URLSearchParams) {
  const labels: Record<string, string> = {
    q: "البحث",
    status: "الحالة",
    active: "نشاط السجل",
    from: "من",
    to: "إلى",
  };
  return [...params.entries()]
    .filter(([key, value]) => key !== "dataset" && key !== "format" && Boolean(value))
    .map(([key, value]) => `${labels[key] ?? key}: ${value}`)
    .join(" | ");
}

function isDataset(value: string | null): value is Dataset {
  return value !== null && Object.hasOwn(DATASETS, value);
}

function isImportDataset(value: unknown): value is ImportDataset {
  return typeof value === "string" && Object.hasOwn(IMPORTS, value);
}

function dateRange(params: URLSearchParams) {
  const from = params.get("from");
  const to = params.get("to");
  const validDate = (value: string | null) =>
    value === null ||
    (/^\d{4}-\d{2}-\d{2}$/u.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
  if (!validDate(from) || !validDate(to)) return null;
  const gte = from ? new Date(`${from}T00:00:00.000+01:00`) : undefined;
  const lte = to ? new Date(`${to}T23:59:59.999+01:00`) : undefined;
  if (gte && lte && gte > lte) return null;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function safeCell(value: CellValue): CellValue {
  if (typeof value !== "string") return value;
  return /^[\s\uFEFF]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function displayStatus(value: string) {
  return titleByStatus[value] ?? value;
}

async function loadRows(
  dataset: Dataset,
  params: URLSearchParams,
  role: unknown,
): Promise<ExportRow[]> {
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const status = params.get("status");
  const active = params.get("active");
  const createdAt = dateRange(params) ?? {};
  switch (dataset) {
    case "products": {
      const requestedStatus = params.get("status");
      const products = await prisma.product.findMany({
        where: {
          createdAt,
          AND: [
            query
              ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] }
              : {},
            requestedStatus === "normal" || requestedStatus === "low" || requestedStatus === "out"
              ? inventoryStatusWhere(requestedStatus)
              : {},
          ],
        },
        select: { name: true, sku: true, quantity: true, unit: true, minQuantity: true, classification: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return products.map((p) => ({
        ...p,
        classification: classificationLabels[p.classification],
        status: displayStatus(inventoryStatus(p.quantity, p.minQuantity)),
      }));
    }
    case "movements": {
      const records = await prisma.stockMovement.findMany({
        where: {
          createdAt,
          ...(status === "IN" || status === "OUT" ? { type: status } : {}),
          ...(query ? { OR: [
            { product: { name: { contains: query, mode: "insensitive" } } },
            { product: { sku: { contains: query, mode: "insensitive" } } },
            { reason: { contains: query, mode: "insensitive" } },
            { reference: { contains: query, mode: "insensitive" } },
          ] } : {}),
        },
        select: { createdAt: true, type: true, quantity: true, reason: true, reference: true, product: { select: { name: true, sku: true, unit: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return records.map((r) => ({ createdAt: r.createdAt, name: r.product.name, sku: r.product.sku, type: r.type === "IN" ? "استلام" : "صرف", quantity: r.quantity, unit: r.product.unit, reason: r.reason, reference: r.reference }));
    }
    case "suppliers": {
      const records = await prisma.supplier.findMany({
        where: {
          createdAt,
          ...(active === "active" || active === "inactive" ? { isActive: active === "active" } : {}),
          ...(query ? { OR: [
            { name: { contains: query, mode: "insensitive" } },
            { contactPerson: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ] } : {}),
        },
        select: { name: true, contactPerson: true, phone: true, email: true, address: true, notes: true, isActive: true, createdAt: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return records.map((r) => ({
        name: r.name,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        address: r.address,
        notes: r.notes,
        status: r.isActive ? "نشط" : "غير نشط",
        createdAt: r.createdAt,
      }));
    }
    case "purchase-orders": {
      const records = await prisma.purchaseOrder.findMany({
        where: {
          createdAt,
          ...(status && isPurchaseOrderStatus(status) ? { status } : {}),
          ...(query ? { OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { supplier: { name: { contains: query, mode: "insensitive" } } },
          ] } : {}),
        },
        select: {
          orderNumber: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          receivedAt: true,
          supplier: { select: { name: true } },
          lines: { select: { productName: true, productSku: true, unit: true, orderedQuantity: true, receivedQuantity: true }, orderBy: { id: "asc" } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return records.map((r) => ({
        orderNumber: r.orderNumber,
        supplier: r.supplier.name,
        status: displayStatus(r.status),
        lineCount: r._count.lines,
        lineDetails: r.lines.map((line) => `${line.productName} (${line.productSku}) · ${line.orderedQuantity} ${line.unit} · المستلم ${line.receivedQuantity}`).join("\n"),
        createdAt: r.createdAt,
        submittedAt: r.submittedAt,
        receivedAt: r.receivedAt,
      }));
    }
    case "boms": {
      const records = await prisma.billOfMaterials.findMany({
        where: {
          createdAt,
          ...(status && isBomStatus(status) ? { status } : {}),
          ...(query ? { OR: [
            { finishedProductName: { contains: query, mode: "insensitive" } },
            { finishedProductSku: { contains: query, mode: "insensitive" } },
          ] } : {}),
        },
        select: {
          finishedProductName: true,
          finishedProductSku: true,
          revision: true,
          status: true,
          createdAt: true,
          components: { select: { materialName: true, materialSku: true, quantityPerUnit: true, unit: true }, orderBy: { id: "asc" } },
          _count: { select: { components: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return records.map((r) => ({
        product: r.finishedProductName,
        sku: r.finishedProductSku,
        revision: r.revision,
        componentCount: r._count.components,
        componentDetails: r.components.map((component) => `${component.materialName} (${component.materialSku}) · ${component.quantityPerUnit.toString()} ${component.unit}`).join("\n"),
        status: displayStatus(r.status),
        createdAt: r.createdAt,
      }));
    }
    case "production-orders": {
      const records = await prisma.productionOrder.findMany({
        where: {
          createdAt,
          ...(status && isProductionOrderStatus(status) ? { status } : {}),
          ...(query ? { OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { bom: { is: { finishedProductName: { contains: query, mode: "insensitive" } } } },
            { bom: { is: { finishedProductSku: { contains: query, mode: "insensitive" } } } },
          ] } : {}),
        },
        select: { orderNumber: true, status: true, plannedQuantity: true, producedQuantity: true, plannedStartDate: true, expectedCompletionDate: true, notes: true, createdAt: true, bom: { select: { finishedProductName: true, revision: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return records.map((r) => ({ orderNumber: r.orderNumber, product: r.bom.finishedProductName, revision: r.bom.revision, plannedQuantity: Number(r.plannedQuantity), producedQuantity: r.producedQuantity === null ? null : Number(r.producedQuantity), status: displayStatus(r.status), plannedStartDate: r.plannedStartDate, expectedCompletionDate: r.expectedCompletionDate, notes: r.notes, createdAt: r.createdAt }));
    }
    case "customers": {
      const records = await prisma.customer.findMany({
        where: {
          createdAt,
          ...(active === "active" || active === "inactive" ? { isActive: active === "active" } : {}),
          ...(query ? { OR: [
            { name: { contains: query, mode: "insensitive" } },
            { contactPerson: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ] } : {}),
        },
        select: { name: true, contactPerson: true, phone: true, email: true, city: true, address: true, notes: true, isActive: true, createdAt: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return records.map((r) => ({
        name: r.name,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        city: r.city,
        address: r.address,
        notes: r.notes,
        status: r.isActive ? "نشط" : "غير نشط",
        createdAt: r.createdAt,
      }));
    }
    case "customer-orders": {
      const records = await prisma.customerOrder.findMany({
        where: {
          createdAt,
          ...(status && isCustomerOrderStatus(status) ? { status } : {}),
          ...(query ? { OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { lines: { some: { OR: [
              { productName: { contains: query, mode: "insensitive" } },
              { productSku: { contains: query, mode: "insensitive" } },
            ] } } },
          ] } : {}),
        },
        select: {
          orderNumber: true,
          customerName: true,
          status: true,
          expectedFulfillmentAt: true,
          notes: true,
          createdAt: true,
          lines: { select: { productName: true, productSku: true, unit: true, orderedQuantity: true }, orderBy: { id: "asc" } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return records.map((r) => ({
        orderNumber: r.orderNumber,
        customer: r.customerName,
        status: displayStatus(r.status),
        lineCount: r._count.lines,
        lineDetails: r.lines.map((line) => `${line.productName} (${line.productSku}) · ${line.orderedQuantity} ${line.unit}`).join("\n"),
        expectedFulfillmentAt: r.expectedFulfillmentAt,
        notes: r.notes,
        createdAt: r.createdAt,
      }));
    }
    case "deliveries": {
      const records = await prisma.deliveryShipment.findMany({
        where: {
          createdAt,
          ...(isDeliveryShipmentStatus(status) ? { status } : {}),
          ...(query ? { OR: [
            { reference: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { region: { contains: query, mode: "insensitive" } },
            { address: { contains: query, mode: "insensitive" } },
            { order: { orderNumber: { contains: query, mode: "insensitive" } } },
          ] } : {}),
        },
        select: { reference: true, customerName: true, customerPhone: true, region: true, address: true, expectedDeliveryAt: true, deliveredAt: true, notes: true, status: true, order: { select: { orderNumber: true } }, run: { select: { runNumber: true } } },
        orderBy: [{ expectedDeliveryAt: "asc" }, { createdAt: "desc" }],
      });
      return records.map((r) => ({ reference: r.reference, orderNumber: r.order.orderNumber, customer: r.customerName, customerPhone: r.customerPhone, region: r.region, address: r.address, expectedDeliveryAt: r.expectedDeliveryAt, deliveredAt: r.deliveredAt, notes: r.notes, runNumber: r.run?.runNumber ?? "", status: displayStatus(r.status) }));
    }
    case "delivery-runs": {
      const records = await prisma.deliveryRun.findMany({
        where: {
          createdAt,
          ...(status && isDeliveryRunStatus(status) ? { status } : {}),
          ...(query ? { OR: [
            { runNumber: { contains: query, mode: "insensitive" } },
            { region: { contains: query, mode: "insensitive" } },
            { driver: { name: { contains: query, mode: "insensitive" } } },
            { vehicle: { plate: { contains: query, mode: "insensitive" } } },
          ] } : {}),
        },
        select: { runNumber: true, region: true, scheduledAt: true, status: true, driver: { select: { name: true } }, vehicle: { select: { plate: true } }, _count: { select: { shipments: true } } },
        orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
      });
      return records.map((r) => ({ runNumber: r.runNumber, region: r.region, driver: r.driver.name, vehicle: r.vehicle.plate, scheduledAt: r.scheduledAt, shipmentCount: r._count.shipments, status: displayStatus(r.status) }));
    }
    case "fleet": {
      const [drivers, vehicles] = await Promise.all([
        prisma.deliveryDriver.findMany({
          where: { createdAt, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query, mode: "insensitive" } }] } : {}) },
          select: { name: true, phone: true, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.deliveryVehicle.findMany({
          where: { createdAt, ...(query ? { OR: [{ plate: { contains: query, mode: "insensitive" } }, { label: { contains: query, mode: "insensitive" } }] } : {}) },
          select: { plate: true, label: true, type: true, maxStops: true, isActive: true },
          orderBy: { plate: "asc" },
        }),
      ]);
      return [
        ...drivers.map((d) => ({ recordType: "سائق", name: d.name, details: d.phone, maxStops: null, status: d.isActive ? "نشط" : "غير نشط" })),
        ...vehicles.map((v) => ({ recordType: "مركبة", name: v.plate, details: `${v.label} · ${v.type}`, maxStops: v.maxStops, status: v.isActive ? "نشط" : "غير نشط" })),
      ];
    }
    case "executive": {
      const canReadInventory = hasPermission(role, "inventory.read");
      const canReadSuppliers = hasPermission(role, "supplier.read");
      const canReadPurchasing = hasPermission(role, "purchase_order.read");
      const canReadProduction = hasPermission(role, "production.order.read");
      const canReadSales = hasPermission(role, "sales.read");
      const canReadDistribution = hasPermission(role, "distribution.read");
      const [
        products,
        lowStock,
        suppliers,
        purchaseOrders,
        productionOrders,
        salesOrders,
        deliveries,
      ] = await Promise.all([
        canReadInventory ? prisma.product.count() : Promise.resolve(null),
        canReadInventory
          ? prisma.product.count({ where: inventoryStatusWhere("low") })
          : Promise.resolve(null),
        canReadSuppliers
          ? prisma.supplier.count({ where: { isActive: true } })
          : Promise.resolve(null),
        canReadPurchasing
          ? prisma.purchaseOrder.count({ where: { status: { in: ["DRAFT", "SUBMITTED", "PARTIALLY_RECEIVED"] } } })
          : Promise.resolve(null),
        canReadProduction
          ? prisma.productionOrder.count({ where: { status: { in: ["DRAFT", "IN_PROGRESS"] } } })
          : Promise.resolve(null),
        canReadSales
          ? prisma.customerOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } })
          : Promise.resolve(null),
        canReadDistribution
          ? prisma.deliveryShipment.count({ where: { status: { in: ["PREPARING", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT"] } } })
          : Promise.resolve(null),
      ]);
      return [
        ...(products === null ? [] : [{ metric: "إجمالي الأصناف", value: products }]),
        ...(lowStock === null ? [] : [{ metric: "أصناف منخفضة المخزون", value: lowStock }]),
        ...(suppliers === null ? [] : [{ metric: "الموردون النشطون", value: suppliers }]),
        ...(purchaseOrders === null ? [] : [{ metric: "أوامر الشراء المفتوحة", value: purchaseOrders }]),
        ...(productionOrders === null ? [] : [{ metric: "أوامر الإنتاج المفتوحة", value: productionOrders }]),
        ...(salesOrders === null ? [] : [{ metric: "طلبات العملاء المفتوحة", value: salesOrders }]),
        ...(deliveries === null ? [] : [{ metric: "الشحنات النشطة", value: deliveries }]),
      ];
    }
  }
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/gu, "-").replace(/^-|-$/gu, "").toLowerCase();
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function wordRun(value: string, bold = false, white = false, size?: number) {
  return `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${white ? '<w:color w:val="FFFFFF"/>' : ""}${size ? `<w:sz w:val="${size}"/>` : ""}<w:rtl/><w:lang w:val="ar-DZ"/></w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
}

function wordParagraph(value: string, bold = false, size = 22) {
  return `<w:p><w:pPr><w:bidi/><w:spacing w:after="120"/></w:pPr>${wordRun(value, bold, false, size)}</w:p>`;
}

function wordTable(columnsForTable: Column[], rows: ExportRow[]) {
  const width = Math.floor(9800 / columnsForTable.length);
  const rowXml = (values: string[], header: boolean) =>
    `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${values.map((value) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:fill="0F4C81"/>' : ""}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:bidi/></w:pPr>${wordRun(value, header, header)}</w:p></w:tc>`).join("")}</w:tr>`;
  const header = rowXml(columnsForTable.map((column) => column.header), true);
  const data = rows.map((row) =>
    rowXml(columnsForTable.map((column) => {
      const value = row[column.key];
      return value instanceof Date
        ? new Intl.DateTimeFormat("ar-DZ", { dateStyle: "medium", timeZone: "Africa/Algiers" }).format(value)
        : value === null ? "" : String(value);
    }), false),
  ).join("");
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders></w:tblPr>${header}${data}</w:tbl>`;
}

async function makeDocx(title: string, cols: Column[], rows: ExportRow[], filterSummary: string) {
  if (rows.length > 5000) throw new ExportLimitError("يتجاوز التقرير 5000 سجل لتصدير Word؛ استخدم Excel أو ضيّق عوامل التصفية.");
  const zip = new JSZip();
  const created = new Date();
  const pageSize = cols.length > 5
    ? '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
    : '<w:pgSz w:w="11906" w:h="16838"/>';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${wordParagraph("IMDAD DZ", true, 28)}${wordParagraph(title, true, 32)}${wordParagraph(`تاريخ الإنشاء: ${new Intl.DateTimeFormat("ar-DZ", { dateStyle: "full", timeZone: "Africa/Algiers" }).format(created)}`)}${filterSummary ? wordParagraph(`عوامل التصفية: ${filterSummary}`) : ""}${wordTable(cols, rows)}<w:sectPr><w:footerReference w:type="default" r:id="rId1"/>${pageSize}<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("word/document.xml", document);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  zip.file("word/footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t>ImdadDZ · </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:rtl/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="ar-DZ"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>ImdadDZ</dc:creator><dc:description>ImdadDZ report generated ${created.toISOString()}</dc:description></cp:coreProperties>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function templateResponse(dataset: ImportDataset) {
  const config = IMPORTS[dataset];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("البيانات", { views: [{ rightToLeft: true }] });
  sheet.columns = config.columns.map(({ header }) => ({ header, width: Math.max(20, header.length + 4) }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: config.columns.length } };
  const instructions = workbook.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  instructions.addRows([
    ["قالب استيراد ImdadDZ / ImdadDZ import template", config.title],
    ["النمط / Mode", "إضافة سجلات جديدة فقط / Create new records only. لا يتم تحديث السجلات الموجودة / Existing records are never updated."],
    ["ملاحظة / Note", dataset === "products" ? "يجب أن تكون الكمية الابتدائية 0 / Initial quantity must be 0. لا تُنشأ حركات المخزون بالاستيراد / Imports do not create stock movements." : "املأ الصفوف بعد عناوين الأعمدة / Enter data below the headers. لا تحذف السجلات أو تعدلها / No updates or deletions."],
    ["التصنيف / Classification", dataset === "products" ? "UNCLASSIFIED أو MATERIAL أو FINISHED_GOOD أو BOTH." : "لا ينطبق / Not applicable."],
    ["التحقق / Validation", "الحقول المطلوبة وصحة البريد الإلكتروني والتكرار تظهر في المعاينة / Preview reports required fields, email validity, and duplicates."],
    ["الحد الأقصى / Maximum", "1000 صف / rows per import."],
  ]);
  instructions.getColumn(1).width = 28;
  instructions.getColumn(2).width = 90;
  instructions.getRow(1).font = { bold: true, size: 14 };
  return workbook.xlsx.writeBuffer();
}

function stringValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) return "";
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
  }
  return String(value).trim();
}

function parseImportRows(workbook: ExcelJS.Workbook, dataset: ImportDataset) {
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) throw new ImportFileError("ملف Excel فارغ أو لا يحتوي على ورقة بيانات.");
  const config = IMPORTS[dataset];
  const headerKeys = new Map(config.columns.map((column) => [column.header, column.key]));
  const headerRow = sheet.getRow(1);
  const indexes = new Map<string, number>();
  headerRow.eachCell((cell, index) => {
    const key = headerKeys.get(stringValue(cell.value));
    if (key) indexes.set(key, index);
  });
  const missing = config.columns.filter((column) => column.required && !indexes.has(column.key));
  if (missing.length) throw new ImportFileError(`عناوين الأعمدة المطلوبة غير موجودة: ${missing.map((column) => column.header).join("، ")}`);
  if (sheet.rowCount > 1001) throw new ImportFileError("يسمح باستيراد 1000 صف كحد أقصى في كل مرة.");
  const rows: { rowNumber: number; values: ImportRow; parseErrors: string[] }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: ImportRow = {};
    const parseErrors: string[] = [];
    for (const column of config.columns) {
      const index = indexes.get(column.key);
      const cell = index ? row.getCell(index).value : null;
      if (typeof cell === "object" && cell !== null && ("formula" in cell || "sharedFormula" in cell)) {
        parseErrors.push("لا يُسمح بصيغ Excel في ملف الاستيراد.");
        values[column.key] = "";
      } else {
        values[column.key] = index ? stringValue(cell) : "";
      }
    }
    if (Object.values(values).some(Boolean) || parseErrors.length) {
      rows.push({ rowNumber, values, parseErrors });
    }
  });
  return rows;
}

function validateImportRow(dataset: ImportDataset, values: ImportRow) {
  const errors: string[] = [];
  const config = IMPORTS[dataset];
  for (const column of config.columns) {
    const value = values[column.key] ?? "";
    if (column.required && !value) errors.push(`حقل «${column.header}» مطلوب.`);
    if (value.length > 2000) errors.push(`قيمة «${column.header}» طويلة جدًا.`);
  }
  const email = values.email ?? "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.push("البريد الإلكتروني غير صالح.");
  if (dataset === "suppliers") {
    if ((values.name ?? "").length > 120) errors.push("اسم المورد يتجاوز 120 حرفًا.");
    if ((values.contactPerson ?? "").length > 120) errors.push("جهة الاتصال تتجاوز 120 حرفًا.");
    if ((values.phone ?? "").length > 40) errors.push("الهاتف يتجاوز 40 حرفًا.");
    if ((values.email ?? "").length > 254) errors.push("البريد الإلكتروني يتجاوز 254 حرفًا.");
    if ((values.address ?? "").length > 300) errors.push("العنوان يتجاوز 300 حرف.");
    if ((values.notes ?? "").length > 2000) errors.push("الملاحظات تتجاوز 2000 حرف.");
  }
  if (dataset === "customers") {
    if ((values.name ?? "").length > 160) errors.push("اسم العميل يتجاوز 160 حرفًا.");
    if ((values.contactPerson ?? "").length > 120) errors.push("جهة الاتصال تتجاوز 120 حرفًا.");
    if ((values.phone ?? "").length > 40) errors.push("الهاتف يتجاوز 40 حرفًا.");
    if ((values.email ?? "").length > 254) errors.push("البريد الإلكتروني يتجاوز 254 حرفًا.");
    if ((values.city ?? "").length > 120) errors.push("المدينة تتجاوز 120 حرفًا.");
    if ((values.address ?? "").length > 300) errors.push("العنوان يتجاوز 300 حرف.");
    if ((values.notes ?? "").length > 2000) errors.push("الملاحظات تتجاوز 2000 حرف.");
  }
  if (dataset === "products") {
    const quantity = parseInventoryQuantity(values.quantity, true);
    const minimum = parseInventoryQuantity(values.minQuantity, true);
    if (!values.quantity || quantity !== 0) errors.push("يجب أن تكون الكمية الابتدائية رقمًا يساوي 0؛ لا تُنشأ حركات المخزون بالاستيراد.");
    if (!values.minQuantity || minimum === null) errors.push("أدخل حد تنبيه رقميًا صالحًا لا يقل عن صفر.");
    const classification = values.classification || "UNCLASSIFIED";
    if (!["UNCLASSIFIED", "MATERIAL", "FINISHED_GOOD", "BOTH"].includes(classification)) errors.push("تصنيف المنتج غير صالح.");
  }
  return errors;
}

function importPreviewToken(userId: string, dataset: ImportDataset, digest: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("إعداد مفتاح المصادقة مطلوب لإتمام الاستيراد الآمن.");
  const payload = Buffer.from(JSON.stringify({
    userId,
    dataset,
    digest,
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isValidImportPreviewToken(
  token: string,
  userId: string,
  dataset: ImportDataset,
  digest: string,
) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return false;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  ) return false;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data === "object" && data !== null &&
      "userId" in data && data.userId === userId &&
      "dataset" in data && data.dataset === dataset &&
      "digest" in data && data.digest === digest &&
      "expiresAt" in data && typeof data.expiresAt === "number" &&
      data.expiresAt > Date.now();
  } catch {
    return false;
  }
}

async function duplicateReason(dataset: ImportDataset, values: ImportRow) {
  if (dataset === "products") {
    return await prisma.product.findUnique({ where: { sku: values.sku }, select: { id: true } })
      ? "رمز SKU مسجل مسبقًا."
      : null;
  }
  const name = values.name.replace(/\s+/gu, " ").normalize("NFKC");
  if (dataset === "suppliers") {
    const nameKey = name.toLocaleLowerCase("ar");
    return await prisma.supplier.findUnique({ where: { nameKey }, select: { id: true } })
      ? "اسم المورد مسجل مسبقًا."
      : null;
  }
  return await prisma.customer.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  }) ? "يوجد عميل مسجل بالاسم نفسه." : null;
}

async function createImportedRow(dataset: ImportDataset, values: ImportRow) {
  const form = new FormData();
  const classification = values.classification || "UNCLASSIFIED";
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  if (dataset === "products") {
    form.set("quantity", "0");
    form.set("classification", classification);
    return createProduct(form);
  }
  if (dataset === "suppliers") return createSupplier(form);
  return createCustomer(form);
}

export async function GET(request: Request) {
  const principal = await getAuthenticatedPrincipal();
  if (!principal) return Response.json({ error: "Authentication required." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const template = params.get("template");
  if (template) {
    if (!isImportDataset(template)) return Response.json({ error: "نوع القالب غير صالح." }, { status: 400 });
    const importDataset = template;
    if (!hasPermission(principal.role, IMPORTS[importDataset].permission)) return Response.json({ error: "Forbidden." }, { status: 403 });
    const buffer = await templateResponse(importDataset);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="imdad-${importDataset}-template.xlsx"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const rawDataset = params.get("dataset");
  if (!isDataset(rawDataset)) return Response.json({ error: "مجموعة البيانات غير صالحة." }, { status: 400 });
  const dataset = rawDataset;
  if (!hasPermission(principal.role, DATASETS[dataset].permission)) return Response.json({ error: "Forbidden." }, { status: 403 });
  if ((params.has("from") || params.has("to")) && dateRange(params) === null) {
    return Response.json({ error: "أدخل فترة زمنية صحيحة." }, { status: 400 });
  }
  const requestedFormat = params.get("format");
  if (requestedFormat && requestedFormat !== "xlsx" && requestedFormat !== "docx") {
    return Response.json({ error: "صيغة التصدير غير صالحة." }, { status: 400 });
  }
  try {
    const rows = await loadRows(dataset, params, principal.role);
    const cols = columns[dataset];
    const format = requestedFormat === "docx" ? "docx" : "xlsx";
    const stem = `imdad-${safeFileName(dataset)}-${new Date().toISOString().slice(0, 10)}`;
    if (format === "docx") {
      const doc = await makeDocx(DATASETS[dataset].title, cols, rows, filterSummary(params));
      return new Response(doc, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${stem}.docx"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ImdadDZ";
    workbook.created = new Date();
    const maxRowsPerSheet = 1_048_572;
    const sheetCount = Math.max(1, Math.ceil(rows.length / maxRowsPerSheet));
    for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
      const sheetRows = rows.slice(
        sheetIndex * maxRowsPerSheet,
        (sheetIndex + 1) * maxRowsPerSheet,
      );
      const suffix = ` ${sheetIndex + 1}`;
      const sheetName = `${DATASETS[dataset].title.slice(0, 31 - suffix.length)}${suffix}`;
      const sheet = workbook.addWorksheet(sheetName, {
        views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }],
      });
      sheet.columns = cols.map(({ key, width }) => ({ key, width }));
      const titleRow = sheet.addRow([DATASETS[dataset].title]);
      sheet.mergeCells(1, 1, 1, cols.length);
      titleRow.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
      titleRow.alignment = { horizontal: "right" };
      sheet.addRow([`تاريخ الإنشاء: ${new Intl.DateTimeFormat("ar-DZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Algiers" }).format(new Date())}`]);
      sheet.addRow([filterSummary(params) || "لا توجد فلاتر إضافية"]);
      sheet.addRow(cols.map((column) => column.header));
      const header = sheet.getRow(4);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
      header.alignment = { horizontal: "right", vertical: "middle" };
      header.height = 24;
      sheetRows.forEach((source) => {
        const row = sheet.addRow(cols.map((column) => safeCell(source[column.key] ?? null)));
        row.alignment = { horizontal: "right", vertical: "top" };
        cols.forEach((column, index) => {
          if (column.numFmt) row.getCell(index + 1).numFmt = column.numFmt;
        });
      });
      if (sheetRows.length) {
        sheet.autoFilter = {
          from: { row: 4, column: 1 },
          to: { row: sheetRows.length + 4, column: cols.length },
        };
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${stem}.xlsx"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to generate data transfer export", {
      dataset,
      message: error instanceof Error ? error.message : "unknown",
    });
    return Response.json(
      {
        error: error instanceof ExportLimitError
          ? error.message
          : "تعذّر إنشاء الملف بسبب خطأ داخلي.",
      },
      { status: error instanceof ExportLimitError ? 413 : 500 },
    );
  }
}

export async function POST(request: Request) {
  const principal = await getAuthenticatedPrincipal();
  if (!principal) return Response.json({ error: "Authentication required." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "تعذّر قراءة ملف الاستيراد." }, { status: 400 });
  }
  const rawDataset = formData.get("dataset");
  if (!isImportDataset(rawDataset)) {
    return Response.json({ error: "نوع الاستيراد غير صالح." }, { status: 400 });
  }
  const dataset = rawDataset;
  if (!hasPermission(principal.role, IMPORTS[dataset].permission)) return Response.json({ error: "Forbidden." }, { status: 403 });
  const file = formData.get("file");
  const mode = formData.get("mode");
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "اختر ملف Excel صالحًا لا يتجاوز حجمه 5 ميغابايت." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "يدعم الاستيراد ملفات Excel بصيغة .xlsx فقط." }, { status: 400 });
  if (mode !== "preview" && mode !== "confirm") return Response.json({ error: "مرحلة الاستيراد غير صالحة." }, { status: 400 });
  if (!process.env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "إعداد مفتاح المصادقة مطلوب لإتمام الاستيراد الآمن." }, { status: 503 });
  }
  try {
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const digest = createHash("sha256").update(fileBytes).digest("hex");
    const previewToken = formData.get("previewToken");
    if (
      mode === "confirm" &&
      (typeof previewToken !== "string" ||
        !isValidImportPreviewToken(previewToken, principal.id, dataset, digest))
    ) {
      return Response.json({ error: "انتهت صلاحية المعاينة أو تغير الملف؛ أعد معاينة الملف قبل التأكيد." }, { status: 400 });
    }
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBytes);
    } catch {
      throw new ImportFileError("ملف Excel غير صالح أو تالف.");
    }
    const sourceRows = parseImportRows(workbook, dataset);
    if (!sourceRows.length) return Response.json({ error: "لا توجد صفوف بيانات في الملف." }, { status: 400 });
    const seen = new Set<string>();
    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;
    const results: {
      row: number;
      status: "accepted" | "rejected" | "duplicate";
      message: string;
      values: ImportRow;
    }[] = [];
    for (const { rowNumber, values, parseErrors } of sourceRows) {
      const errors = [...parseErrors, ...validateImportRow(dataset, values)];
      const identity = dataset === "products"
        ? values.sku.trim()
        : values.name.trim().replace(/\s+/gu, " ").normalize("NFKC").toLocaleLowerCase("ar");
      const duplicateInFile = !!identity && seen.has(identity);
      if (identity) seen.add(identity);
      let duplicate: string | null = duplicateInFile ? "مكرر في الملف." : null;
      if (!duplicate && !errors.length) {
        try {
          duplicate = await duplicateReason(dataset, values);
        } catch (cause) {
          console.error("Failed to check imported row for duplicates", {
            dataset,
            row: rowNumber,
            message: cause instanceof Error ? cause.message : "unknown",
          });
          errors.push("تعذّر التحقق من التكرار لهذا الصف.");
        }
      }
      if (errors.length) {
        rejected += 1;
        results.push({ row: rowNumber, status: "rejected", message: errors.join(" "), values });
      } else if (duplicate) {
        duplicates += 1;
        results.push({ row: rowNumber, status: "duplicate", message: duplicate, values });
      } else if (mode === "preview") {
        accepted += 1;
        results.push({ row: rowNumber, status: "accepted", message: "جاهز للإضافة.", values });
      } else {
        let created: Awaited<ReturnType<typeof createImportedRow>> | null = null;
        try {
          created = await createImportedRow(dataset, values);
        } catch (cause) {
          console.error("Failed to create imported row", {
            dataset,
            row: rowNumber,
            message: cause instanceof Error ? cause.message : "unknown",
          });
        }
        if (created?.ok) {
          accepted += 1;
          results.push({ row: rowNumber, status: "accepted", message: "تمت الإضافة.", values });
        } else {
          rejected += 1;
          results.push({ row: rowNumber, status: "rejected", message: created?.error ?? "تعذّرت إضافة السجل.", values });
        }
      }
    }
    return Response.json({
      accepted,
      rejected,
      duplicates,
      results,
      confirmed: mode === "confirm",
      ...(mode === "preview" && accepted > 0
        ? { previewToken: importPreviewToken(principal.id, dataset, digest) }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذّر قراءة ملف الاستيراد.";
    if (error instanceof ImportFileError) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("Failed to process data import", {
      dataset,
      message: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "تعذّرت معالجة الاستيراد بسبب خطأ داخلي. لم يتم تجاوز قواعد العمل." }, { status: 500 });
  }
}

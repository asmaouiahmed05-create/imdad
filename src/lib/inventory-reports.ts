import type { Prisma } from "@prisma/client";
import { inventoryStatusWhere } from "@/lib/inventory-status";

export const REPORT_TYPES = [
  "inventory",
  "low-stock",
  "out-of-stock",
  "movements",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export function isReportType(value: string | null): value is ReportType {
  return REPORT_TYPES.some((report) => report === value);
}

export type ReportFilters = {
  report: ReportType;
  query: string;
  from: string;
  to: string;
  page: number;
  dateError: string | null;
};

const reportTitles: Record<ReportType, string> = {
  inventory: "تقرير المخزون",
  "low-stock": "تقرير الأصناف منخفضة المخزون",
  "out-of-stock": "تقرير الأصناف النافدة",
  movements: "تقرير حركات المخزون",
};

export function reportTitle(report: ReportType) {
  return reportTitles[report];
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const requestedReport = params.get("report");
  const report = isReportType(requestedReport) ? requestedReport : "inventory";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  let dateError: string | null = null;

  if ((from && !validDate(from)) || (to && !validDate(to))) {
    dateError = "أدخل تاريخًا صحيحًا للفترة المحددة.";
  } else if (from && to && from > to) {
    dateError = "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.";
  } else if ((from || to) && report !== "movements") {
    dateError = "تصفية التاريخ متاحة في تقرير حركات المخزون فقط.";
  }

  const rawPage = params.get("page") ?? "";
  const requestedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    report,
    query: (params.get("q") ?? "").trim().slice(0, 100),
    from: validDate(from) ? from : "",
    to: validDate(to) ? to : "",
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    dateError,
  };
}

export function productReportWhere(
  report: ReportType,
  query: string,
): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [];
  if (report === "low-stock") conditions.push(inventoryStatusWhere("low"));
  if (report === "out-of-stock") conditions.push(inventoryStatusWhere("out"));
  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  return conditions.length ? { AND: conditions } : {};
}

export function movementReportWhere(
  filters: Pick<ReportFilters, "query" | "from" | "to">,
): Prisma.StockMovementWhereInput {
  const conditions: Prisma.StockMovementWhereInput[] = [];

  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) {
      createdAt.gte = new Date(`${filters.from}T00:00:00.000+01:00`);
    }
    if (filters.to) {
      const endExclusive = new Date(`${filters.to}T00:00:00.000+01:00`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      createdAt.lt = endExclusive;
    }
    conditions.push({ createdAt });
  }

  if (filters.query) {
    conditions.push({
      OR: [
        { product: { name: { contains: filters.query, mode: "insensitive" } } },
        { product: { sku: { contains: filters.query, mode: "insensitive" } } },
        { reason: { contains: filters.query, mode: "insensitive" } },
        { reference: { contains: filters.query, mode: "insensitive" } },
      ],
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

export function reportHref(filters: ReportFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.report !== "inventory") params.set("report", filters.report);
  if (filters.query) params.set("q", filters.query);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}

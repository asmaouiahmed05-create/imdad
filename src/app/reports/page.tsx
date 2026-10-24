import { AlertTriangle, Boxes, CircleCheck, Package, PackageX } from "lucide-react";
import { connection } from "next/server";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportExportButtons } from "@/components/dashboard/ReportExportButtons";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  movementReportWhere,
  parseReportFilters,
  productReportWhere,
  reportHref,
  reportTitle,
} from "@/lib/inventory-reports";
import { inventoryStatus, inventoryStatusWhere } from "@/lib/inventory-status";
import { prisma } from "@/lib/db";
import type { WarehouseProduct } from "@/components/dashboard/types";
import { requirePagePermission } from "@/lib/authz";

const PAGE_SIZE = 20;
const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});
const dateOnlyFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ReportProduct = WarehouseProduct & { createdAt: Date };
type ReportMovement = Prisma.StockMovementGetPayload<{
  include: { product: { select: { name: true; sku: true; unit: true } } };
}>;

function toSearchParams(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) searchParams.append(key, item);
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}

function statusLabel(status: ReturnType<typeof inventoryStatus>) {
  return status === "out"
    ? "نفد المخزون"
    : status === "low"
      ? "مخزون منخفض"
      : "متوفر";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("reports.read");
  await connection();
  const filters = parseReportFilters(toSearchParams(await searchParams));
  const productWhere = productReportWhere(filters.report, filters.query);
  const movementWhere = movementReportWhere(filters);

  const [
    totalProducts,
    inventory,
    lowStockCount,
    outOfStockCount,
    availableCount,
    resultCount,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.aggregate({ _sum: { quantity: true } }),
    prisma.product.count({ where: inventoryStatusWhere("low") }),
    prisma.product.count({ where: inventoryStatusWhere("out") }),
    prisma.product.count({ where: inventoryStatusWhere("normal") }),
    filters.dateError
      ? Promise.resolve(0)
      : filters.report === "movements"
        ? prisma.stockMovement.count({ where: movementWhere })
        : prisma.product.count({ where: productWhere }),
  ]);

  const totalPages = Math.ceil(resultCount / PAGE_SIZE);
  const currentPage =
    totalPages === 0 ? 1 : Math.min(filters.page, totalPages);
  let productRows: ReportProduct[] = [];
  let movementRows: ReportMovement[] = [];

  if (!filters.dateError && filters.report === "movements") {
    movementRows = await prisma.stockMovement.findMany({
      where: movementWhere,
      include: {
        product: { select: { name: true, sku: true, unit: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
  } else if (!filters.dateError) {
    productRows = await prisma.product.findMany({
      where: productWhere,
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
        minQuantity: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
  }

  const generatedAt = new Date();
  const exportParams = new URLSearchParams();
  exportParams.set("report", filters.report);
  if (filters.query) exportParams.set("q", filters.query);
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  const exportUrl = `/api/reports/export?${exportParams.toString()}`;
  const showingFrom = resultCount ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(currentPage * PAGE_SIZE, resultCount);

  return (
    <main
      id="inventory-report"
      className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التقارير
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            تقارير المخزون
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            تقارير مبنية على بيانات الأصناف وحركات المخزون المسجلة.
          </p>
        </div>
        <ReportExportButtons exportUrl={exportUrl} />
      </section>

      <section
        aria-label="ملخص المخزون"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <StatCard
          label="عدد الأصناف"
          value={numberFormatter.format(totalProducts)}
          icon={Boxes}
          accent="amber"
        />
        <StatCard
          label="إجمالي الكمية (مجموع وحدات مختلفة)"
          value={numberFormatter.format(inventory._sum.quantity ?? 0)}
          icon={Package}
          accent="blue"
        />
        <StatCard
          label="أصناف منخفضة المخزون"
          value={numberFormatter.format(lowStockCount)}
          icon={AlertTriangle}
          accent="violet"
        />
        <StatCard
          label="أصناف نفدت"
          value={numberFormatter.format(outOfStockCount)}
          icon={PackageX}
          accent="rose"
        />
        <StatCard
          label="أصناف متوفرة"
          value={numberFormatter.format(availableCount)}
          icon={CircleCheck}
          accent="emerald"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-base font-semibold text-white">
              {reportTitle(filters.report)}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {filters.report === "movements"
                ? "سجل الحركات مع إمكانية تحديد فترة زمنية."
                : "يعرض جميع النتائج المطابقة؛ التصدير يشمل كامل النتائج وليس الصفحة الحالية فقط."}
            </p>
          </div>
          <Badge className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">
            {numberFormatter.format(resultCount)} نتيجة
          </Badge>
        </div>

        <form
          method="get"
          action="/reports"
          className="no-print flex flex-wrap items-end gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6"
        >
          <label className="grid min-w-48 gap-1.5 text-xs text-slate-400">
            نوع التقرير
            <select
              name="report"
              defaultValue={filters.report}
              className="h-10 rounded-xl border border-white/[0.08] bg-slate-900 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
            >
              <option value="inventory">كل الأصناف</option>
              <option value="low-stock">مخزون منخفض</option>
              <option value="out-of-stock">نفد المخزون</option>
              <option value="movements">حركات المخزون</option>
            </select>
          </label>
          {filters.query && (
            <input type="hidden" name="q" value={filters.query} />
          )}
          {filters.report === "movements" && (
            <>
              <label className="grid gap-1.5 text-xs text-slate-400">
                من تاريخ
                <input
                  type="date"
                  name="from"
                  defaultValue={filters.from}
                  className="h-10 rounded-xl border border-white/[0.08] bg-slate-900 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
                />
              </label>
              <label className="grid gap-1.5 text-xs text-slate-400">
                إلى تاريخ
                <input
                  type="date"
                  name="to"
                  defaultValue={filters.to}
                  className="h-10 rounded-xl border border-white/[0.08] bg-slate-900 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
                />
              </label>
            </>
          )}
          <Button
            type="submit"
            variant="outline"
            className="h-10 border-white/[0.08] bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            تطبيق
          </Button>
          {(filters.query || filters.from || filters.to || filters.dateError) && (
            <Link
              href={`/reports?report=${filters.report}`}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-sky-300 transition hover:bg-sky-400/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
            >
              مسح البحث والتواريخ
            </Link>
          )}
        </form>

        <div className="report-print-meta hidden px-5 py-3 text-sm text-slate-400 sm:px-6">
          <p>تاريخ إنشاء التقرير: {dateFormatter.format(generatedAt)}</p>
          <p>
            النتائج المعروضة: {numberFormatter.format(showingFrom)}–
            {numberFormatter.format(showingTo)} من {numberFormatter.format(resultCount)}
            {" · "}الصفحة {numberFormatter.format(currentPage)} من{" "}
            {numberFormatter.format(Math.max(totalPages, 1))}
          </p>
          {filters.query && <p>عبارة البحث: {filters.query}</p>}
          {filters.from && <p>من تاريخ: {dateOnlyFormatter.format(new Date(`${filters.from}T00:00:00.000Z`))}</p>}
          {filters.to && <p>إلى تاريخ: {dateOnlyFormatter.format(new Date(`${filters.to}T00:00:00.000Z`))}</p>}
        </div>

        {filters.dateError && (
          <p role="alert" className="border-b border-rose-400/10 px-5 py-3 text-sm text-rose-300 sm:px-6">
            {filters.dateError}
          </p>
        )}

        <Table className="report-table min-w-[720px] text-start">
          <TableHeader>
            {filters.report === "movements" ? (
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>رمز SKU</TableHead>
                <TableHead>نوع الحركة</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>المرجع</TableHead>
              </TableRow>
            ) : (
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>رمز SKU</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead>الكمية الحالية</TableHead>
                <TableHead>الحد الأدنى</TableHead>
                {filters.report === "inventory" && <TableHead>الحالة</TableHead>}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {filters.report === "movements"
              ? movementRows.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{dateFormatter.format(movement.createdAt)}</TableCell>
                    <TableCell className="font-medium">{movement.product.name}</TableCell>
                    <TableCell dir="ltr" className="font-mono text-xs">{movement.product.sku}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          movement.type === "IN"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }
                      >
                        {movement.type === "IN" ? "استلام" : "صرف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {numberFormatter.format(movement.quantity)} {movement.product.unit}
                    </TableCell>
                    <TableCell>{movement.reason || "—"}</TableCell>
                    <TableCell dir="auto">{movement.reference || "—"}</TableCell>
                  </TableRow>
                ))
              : productRows.map((product) => {
                  const status = inventoryStatus(product.quantity, product.minQuantity);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell dir="ltr" className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell>{numberFormatter.format(product.quantity)}</TableCell>
                      <TableCell>{numberFormatter.format(product.minQuantity)}</TableCell>
                      {filters.report === "inventory" && (
                        <TableCell>
                          <Badge variant="outline">{statusLabel(status)}</Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
            {resultCount === 0 && (
              <TableRow>
                <TableCell
                  colSpan={filters.report === "movements" ? 7 : filters.report === "inventory" ? 6 : 5}
                  className="h-40 text-center text-sm text-slate-400"
                >
                  {filters.dateError
                    ? "صحّح الفترة الزمنية لعرض التقرير."
                    : filters.query || filters.from || filters.to
                      ? "لا توجد نتائج تطابق البحث أو الفلاتر."
                      : "لا توجد بيانات مسجلة لهذا التقرير بعد."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <nav
          aria-label="التنقل بين صفحات التقرير"
          className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 text-xs text-slate-400 sm:px-6"
        >
          <p aria-live="polite">
            عرض {numberFormatter.format(showingFrom)}–{numberFormatter.format(showingTo)} من{" "}
            {numberFormatter.format(resultCount)} نتيجة
          </p>
          <div className="flex items-center gap-2">
            <span>الصفحة {numberFormatter.format(currentPage)} من {numberFormatter.format(Math.max(totalPages, 1))}</span>
            {currentPage > 1 ? (
              <Link href={reportHref(filters, currentPage - 1)} scroll={false} className="rounded-lg border border-white/[0.08] px-3 py-2 text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50">
                السابقة
              </Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg border border-white/[0.05] px-3 py-2 text-slate-600">السابقة</span>
            )}
            {currentPage < totalPages ? (
              <Link href={reportHref(filters, currentPage + 1)} scroll={false} className="rounded-lg border border-white/[0.08] px-3 py-2 text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50">
                التالية
              </Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg border border-white/[0.05] px-3 py-2 text-slate-600">التالية</span>
            )}
          </div>
        </nav>
        <p className="no-print px-5 pb-4 text-xs text-slate-500 sm:px-6">
          يشمل ملف Excel جميع النتائج المطابقة للفلاتر، وليس الصفحة الحالية فقط.
        </p>
      </section>
    </main>
  );
}

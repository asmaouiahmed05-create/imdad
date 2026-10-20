import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Package,
  PackageX,
} from "lucide-react";
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
import { AddProductDialog } from "@/components/dashboard/AddProductDialog";
import { ProductActions } from "@/components/dashboard/ProductActions";
import { StatCard } from "@/components/dashboard/StatCard";
import { StockStatusChart } from "@/components/dashboard/StockStatusChart";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import type { StockStatusDatum, WarehouseProduct } from "@/components/dashboard/types";
import { prisma } from "@/lib/db";
import {
  inventoryStatus,
  inventoryStatusWhere,
  type InventoryStatus,
} from "@/lib/inventory-status";
import { RecordMovementButton } from "@/components/dashboard/RecordMovementButton";
import { RecentMovementsCard } from "@/components/dashboard/RecentMovementsCard";

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});

const PAGE_SIZE = 10;

type SearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
  page?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(query: string, status: InventoryStatus, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  params.set("page", String(page));
  return `/?${params.toString()}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();

  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const requestedStatus = firstValue(params.status);
  const status: InventoryStatus =
    requestedStatus === "normal" ||
    requestedStatus === "low" ||
    requestedStatus === "out"
      ? requestedStatus
      : "all";
  const rawPage = firstValue(params.page);
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const requestedPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const searchFilter: Prisma.ProductWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  const where: Prisma.ProductWhereInput = {
    AND: [searchFilter, inventoryStatusWhere(status)],
  };

  const [
    totalProducts,
    inventory,
    lowStockCount,
    outOfStockCount,
    availableCount,
    matchingCount,
    topProducts,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.aggregate({
      _sum: { quantity: true },
    }),
    prisma.product.count({ where: inventoryStatusWhere("low") }),
    prisma.product.count({ where: inventoryStatusWhere("out") }),
    prisma.product.count({ where: inventoryStatusWhere("normal") }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      select: { name: true, sku: true, quantity: true },
      orderBy: { quantity: "desc" },
      take: 8,
    }),
  ]);

  const totalPages = Math.ceil(matchingCount / PAGE_SIZE);
  const currentPage =
    totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      quantity: true,
      minQuantity: true,
    },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const stockStatus: StockStatusDatum[] = [
    { name: "متوفر", value: availableCount, color: "#34d399" },
    { name: "مخزون منخفض", value: lowStockCount, color: "#a78bfa" },
    { name: "نفد المخزون", value: outOfStockCount, color: "#fb7185" },
  ];

  const showingFrom = matchingCount ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(currentPage * PAGE_SIZE, matchingCount);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            نظرة عامة
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            ملخص المخزون
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            متابعة مستويات الأصناف والكميات المتاحة في مخازنك.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]" />
            بيانات المخزون مباشرة
          </div>
          <div className="flex items-center gap-2">
            <RecordMovementButton />
            <AddProductDialog />
          </div>
        </div>
      </section>

      <section
        aria-label="إحصائيات المخزون"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <StatCard
          label="عدد الأصناف"
          value={numberFormatter.format(totalProducts)}
          icon={Boxes}
          accent="amber"
        />
        <StatCard
          label="إجمالي الكمية"
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
          label="أصناف نفذت"
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

      <section
        aria-label="تحليلات المخزون"
        className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]"
      >
        <StockStatusChart data={stockStatus} total={totalProducts} />
        <TopProductsChart data={topProducts} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-white">قائمة الأصناف</h2>
            <p className="mt-1 text-xs text-slate-400">
              تفاصيل الكميات وحدود إعادة الطلب لكل صنف.
            </p>
          </div>
          <Badge className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">
            {numberFormatter.format(matchingCount)} صنف
          </Badge>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <form method="get" action="/" className="flex flex-wrap items-end gap-3">
            {query && <input type="hidden" name="q" value={query} />}
            <label className="grid gap-1.5 text-xs text-slate-400">
              تصفية حسب الحالة
              <select
                aria-label="تصفية الأصناف حسب حالة المخزون"
                name="status"
                defaultValue={status}
                className="h-10 min-w-44 rounded-xl border border-white/[0.08] bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
              >
                <option value="all">كل الأصناف</option>
                <option value="normal">متوفر</option>
                <option value="low">مخزون منخفض</option>
                <option value="out">نفد المخزون</option>
              </select>
            </label>
            <Button
              type="submit"
              variant="outline"
              className="h-10 border-white/[0.08] bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              تطبيق
            </Button>
          </form>
          {(query || status !== "all") && (
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-sky-300 transition hover:bg-sky-400/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
            >
              مسح البحث والتصفية
            </Link>
          )}
        </div>

        <Table className="min-w-[720px] text-start">
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="h-12 px-5 text-start text-xs font-medium text-slate-400 sm:px-6">
                الصنف
              </TableHead>
              <TableHead className="text-start text-xs font-medium text-slate-400">
                رمز SKU
              </TableHead>
              <TableHead className="text-start text-xs font-medium text-slate-400">
                الوحدة
              </TableHead>
              <TableHead className="text-start text-xs font-medium text-slate-400">
                الكمية
              </TableHead>
              <TableHead className="text-start text-xs font-medium text-slate-400">
                الحد الأدنى
              </TableHead>
              <TableHead className="pe-5 text-start text-xs font-medium text-slate-400 sm:pe-6">
                الحالة
              </TableHead>
              <TableHead className="text-end text-xs font-medium text-slate-400">
                إجراءات
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="h-44 px-6 text-center"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <PackageX
                      aria-hidden="true"
                      className="size-8 text-slate-500"
                    />
                    <p className="text-sm font-medium text-slate-200">
                      {query || status !== "all"
                        ? "لا توجد أصناف تطابق البحث أو التصفية"
                        : "لا توجد أصناف في المخزون بعد"}
                    </p>
                    <p className="text-xs leading-5 text-slate-400">
                      {query || status !== "all"
                        ? "جرّب تغيير عبارة البحث أو حالة المخزون."
                        : "أضف صنفًا جديدًا للبدء في متابعة مخزونك."}
                    </p>
                    {(query || status !== "all") && (
                      <Link
                        href="/"
                        className="mt-1 text-xs font-medium text-sky-300 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                      >
                        مسح البحث والتصفية
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <ProductTableRow key={product.id} product={product} />
              ))
            )}
          </TableBody>
        </Table>
        <nav
          aria-label="التنقل بين صفحات الأصناف"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 text-xs text-slate-400 sm:px-6"
        >
          <p aria-live="polite">
            عرض {numberFormatter.format(showingFrom)}–
            {numberFormatter.format(showingTo)} من{" "}
            {numberFormatter.format(matchingCount)} صنف
          </p>
          <div className="flex items-center gap-2">
            <span className="px-2">
              الصفحة {numberFormatter.format(currentPage)} من{" "}
              {numberFormatter.format(Math.max(totalPages, 1))}
            </span>
            {currentPage > 1 ? (
              <Link
                href={pageHref(query, status, currentPage - 1)}
                scroll={false}
                aria-label="الصفحة السابقة"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
                السابق
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.05] px-3 text-slate-600"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
                السابق
              </span>
            )}
            {currentPage < totalPages ? (
              <Link
                href={pageHref(query, status, currentPage + 1)}
                scroll={false}
                aria-label="الصفحة التالية"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
              >
                التالي
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.05] px-3 text-slate-600"
              >
                التالي
                <ChevronLeft aria-hidden="true" className="size-4" />
              </span>
            )}
          </div>
        </nav>
      </section>
      <RecentMovementsCard />
    </main>
  );
}

function ProductTableRow({ product }: { product: WarehouseProduct }) {
  const productStatus = inventoryStatus(product.quantity, product.minQuantity);
  const status = {
    normal: {
      label: "متوفر",
      className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    },
    low: {
      label: "مخزون منخفض",
      className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    },
    out: {
      label: "نفد المخزون",
      className: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    },
  }[productStatus];

  return (
    <TableRow className="border-white/[0.05] text-slate-300 hover:bg-white/[0.025]">
      <TableCell className="px-5 py-4 sm:px-6">
        <span className="font-medium text-slate-100">{product.name}</span>
      </TableCell>
      <TableCell className="font-mono text-xs text-slate-400" dir="ltr">
        {product.sku}
      </TableCell>
      <TableCell className="text-slate-400">{product.unit}</TableCell>
      <TableCell className="font-medium tabular-nums text-slate-200">
        {numberFormatter.format(product.quantity)}
      </TableCell>
      <TableCell className="tabular-nums text-slate-400">
        {numberFormatter.format(product.minQuantity)}
      </TableCell>
      <TableCell className="pe-5 sm:pe-6">
        <Badge
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.className}`}
        >
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="text-end">
        <ProductActions
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            minQuantity: product.minQuantity,
          }}
        />
      </TableCell>
    </TableRow>
  );
}

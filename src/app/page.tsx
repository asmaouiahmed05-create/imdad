import { AlertTriangle, Boxes, CircleCheck, Package, PackageX } from "lucide-react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/StatCard";
import { StockStatusChart } from "@/components/dashboard/StockStatusChart";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import type { StockStatusDatum, WarehouseProduct } from "@/components/dashboard/types";
import { prisma } from "@/lib/db";

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});

export default async function Home() {
  await connection();

  const [products, inventory] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
        minQuantity: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.aggregate({
      _sum: { quantity: true },
    }),
  ]);

  const totals = products.reduce(
    (result, product) => {
      if (product.quantity <= product.minQuantity) result.lowStock += 1;
      if (product.quantity === 0) {
        result.outOfStock += 1;
      } else if (product.quantity <= product.minQuantity) {
        result.chartLowStock += 1;
      } else {
        result.available += 1;
      }
      return result;
    },
    { lowStock: 0, outOfStock: 0, chartLowStock: 0, available: 0 },
  );

  const stockStatus: StockStatusDatum[] = [
    { name: "متوفر", value: totals.available, color: "#34d399" },
    { name: "مخزون منخفض", value: totals.chartLowStock, color: "#a78bfa" },
    { name: "نفد المخزون", value: totals.outOfStock, color: "#fb7185" },
  ];

  const topProducts = [...products]
    .sort((first, second) => second.quantity - first.quantity)
    .slice(0, 8)
    .map(({ name, sku, quantity }) => ({ name, sku, quantity }));

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
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]" />
          بيانات المخزون مباشرة
        </div>
      </section>

      <section
        aria-label="إحصائيات المخزون"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <StatCard
          label="عدد الأصناف"
          value={numberFormatter.format(products.length)}
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
          value={numberFormatter.format(totals.lowStock)}
          icon={AlertTriangle}
          accent="violet"
        />
        <StatCard
          label="أصناف نفذت"
          value={numberFormatter.format(totals.outOfStock)}
          icon={PackageX}
          accent="rose"
        />
        <StatCard
          label="أصناف متوفرة"
          value={numberFormatter.format(totals.available)}
          icon={CircleCheck}
          accent="emerald"
        />
      </section>

      <section
        aria-label="تحليلات المخزون"
        className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]"
      >
        <StockStatusChart data={stockStatus} total={products.length} />
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
            {numberFormatter.format(products.length)} صنف
          </Badge>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-sm text-slate-400"
                >
                  لا توجد عناصر بعد
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <ProductTableRow key={product.id} product={product} />
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}

function ProductTableRow({ product }: { product: WarehouseProduct }) {
  const outOfStock = product.quantity === 0;
  const lowStock = product.quantity <= product.minQuantity;
  const status = outOfStock
    ? {
        label: "نفد المخزون",
        className: "border-rose-400/20 bg-rose-400/10 text-rose-300",
      }
    : lowStock
      ? {
          label: "مخزون منخفض",
          className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
        }
      : {
          label: "متوفر",
          className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
        };

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
    </TableRow>
  );
}

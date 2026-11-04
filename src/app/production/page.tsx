import Link from "next/link";
import { Factory, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/StatCard";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  isProductionOrderStatus,
  PRODUCTION_ORDER_STATUS_CLASSES,
  PRODUCTION_ORDER_STATUS_LABELS,
} from "@/lib/production-orders";

type SearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
}>;

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
const numberFormatter = new Intl.NumberFormat("ar-DZ");
const quantityFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 6,
});

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requirePagePermission("production.order.read");
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "")
    .trim()
    .slice(0, 100);
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const status = isProductionOrderStatus(rawStatus) ? rawStatus : null;
  const where: Prisma.ProductionOrderWhereInput = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            {
              bom: {
                is: {
                  finishedProductName: { contains: query, mode: "insensitive" },
                },
              },
            },
            {
              bom: {
                is: {
                  finishedProductSku: { contains: query, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [total, drafts, inProgress, completed, orders] = await Promise.all([
    prisma.productionOrder.count(),
    prisma.productionOrder.count({ where: { status: "DRAFT" } }),
    prisma.productionOrder.count({ where: { status: "IN_PROGRESS" } }),
    prisma.productionOrder.count({ where: { status: "COMPLETED" } }),
    prisma.productionOrder.findMany({
      where,
      include: { bom: { select: { finishedProductName: true, revision: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);
  const canManage = hasPermission(principal.role, "production.order.manage");

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التصنيع
          </p>
          <h1 className="text-2xl font-semibold text-white">لوحة الإنتاج</h1>
          <p className="mt-2 text-sm text-slate-400">
            أوامر الإنتاج المسجلة، مرتبطة بمراجعات قوائم المواد والمخزون.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/production/boms" />}>
            قوائم المواد
          </Button>
          {canManage && (
            <Button render={<Link href="/production/orders/new" />}>
              <Plus aria-hidden="true" />
              إنشاء أمر إنتاج
            </Button>
          )}
        </div>
      </header>

      <section
        aria-label="ملخص أوامر الإنتاج"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard label="إجمالي الأوامر" value={numberFormatter.format(total)} icon={Factory} accent="blue" />
        <StatCard label="مسودات" value={numberFormatter.format(drafts)} icon={Factory} accent="violet" />
        <StatCard label="قيد الإنتاج" value={numberFormatter.format(inProgress)} icon={Factory} accent="amber" />
        <StatCard label="مكتمل" value={numberFormatter.format(completed)} icon={Factory} accent="emerald" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 border-b border-white/[0.06] p-4"
        >
          <label className="grid min-w-56 flex-1 gap-1.5 text-xs text-slate-400">
            ابحث برقم الأمر أو المنتج
            <Input
              name="q"
              defaultValue={query}
              maxLength={100}
              className="h-10 border-white/[0.08] bg-slate-950"
            />
          </label>
          <label className="grid min-w-44 gap-1.5 text-xs text-slate-400">
            الحالة
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="">كل الحالات</option>
              {Object.entries(PRODUCTION_ORDER_STATUS_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <Button type="submit" variant="outline">
            تطبيق
          </Button>
        </form>

        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead>رقم الأمر</TableHead>
              <TableHead>المنتج النهائي</TableHead>
              <TableHead>مراجعة القائمة</TableHead>
              <TableHead>الكمية المخططة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead className="text-end">التفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center text-slate-400">
                  لا توجد أوامر إنتاج مطابقة.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="border-white/[0.05]">
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="font-medium text-white">
                    {order.bom.finishedProductName}
                  </TableCell>
                  <TableCell>مراجعة {order.bom.revision}</TableCell>
                  <TableCell>
                    {quantityFormatter.format(Number(order.plannedQuantity))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={PRODUCTION_ORDER_STATUS_CLASSES[order.status]}
                    >
                      {PRODUCTION_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {dateFormatter.format(order.createdAt)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      render={
                        <Link href={`/production/orders/${order.id}`} />
                      }
                    >
                      فتح
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {orders.length === 100 && (
          <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-slate-400">
            تُعرض أحدث 100 نتيجة كحد أقصى؛ استخدم البحث والحالة لتضييق النتائج.
          </p>
        )}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Factory,
  PlayCircle,
  Plus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProductionDemo } from "@/components/production/ProductionDemoProvider";
import {
  PRODUCTION_STATUS_CLASSES,
  PRODUCTION_STATUS_LABELS,
  type ProductionStatus,
} from "@/lib/production-demo";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default function ProductionPage() {
  const { orders, ready, error } = useProductionDemo();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProductionStatus>(
    "ALL",
  );

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return orders.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        order.number.toLocaleLowerCase().includes(normalizedQuery) ||
        order.product.toLocaleLowerCase("ar").includes(normalizedQuery);
      return (
        matchesQuery &&
        (statusFilter === "ALL" || order.status === statusFilter)
      );
    });
  }, [orders, query, statusFilter]);

  const countByStatus = (status: ProductionStatus) =>
    orders.filter((order) => order.status === status).length;

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التصنيع
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            لوحة الإنتاج
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            تابع أوامر الإنتاج التجريبية وحالتها.
          </p>
        </div>
        <Button render={<Link href="/production/orders/new" />}>
          <Plus aria-hidden="true" />
          إنشاء أمر إنتاج
        </Button>
      </section>

      <p
        role="note"
        className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200"
      >
        نموذج تفاعلي: تُحفظ أوامر العرض في هذا المتصفح فقط. لا تُرسل إلى خادم
        ولا تغيّر المخزون أو حركاته.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      <section
        aria-label="ملخص أوامر الإنتاج"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="إجمالي الأوامر"
          value={ready ? numberFormatter.format(orders.length) : "—"}
          icon={ClipboardList}
          accent="blue"
        />
        <StatCard
          label="مخطط"
          value={ready ? numberFormatter.format(countByStatus("PLANNED")) : "—"}
          icon={CalendarDays}
          accent="violet"
        />
        <StatCard
          label="قيد الإنتاج"
          value={
            ready ? numberFormatter.format(countByStatus("IN_PROGRESS")) : "—"
          }
          icon={PlayCircle}
          accent="amber"
        />
        <StatCard
          label="مكتمل"
          value={
            ready ? numberFormatter.format(countByStatus("COMPLETED")) : "—"
          }
          icon={CircleCheck}
          accent="emerald"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <Factory aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                أوامر الإنتاج
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                اختر أمرًا لعرض التفاصيل وتحديث الحالة.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-white/10 bg-slate-900 px-3 py-2 text-slate-300"
          >
            {ready ? numberFormatter.format(orders.length) : "—"} أمر
          </Badge>
        </div>

        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">ابحث برقم الأمر أو المنتج</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث برقم الأمر أو المنتج..."
              className="h-10 border-white/[0.08] bg-slate-950 ps-10"
            />
          </label>
          <label className="sr-only" htmlFor="production-status-filter">
            تصفية حسب الحالة
          </label>
          <select
            id="production-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | ProductionStatus)
            }
            className="h-10 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="ALL">كل الحالات</option>
            {Object.entries(PRODUCTION_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {!ready ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            جارٍ تحميل أوامر العرض...
          </p>
        ) : filteredOrders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">
              {orders.length === 0
                ? "لا توجد أوامر إنتاج بعد."
                : "لا توجد أوامر تطابق البحث."}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {orders.length === 0
                ? "أنشئ أمرًا تجريبيًا ليظهر هنا."
                : "جرّب تغيير عبارة البحث أو الحالة."}
            </p>
            {orders.length === 0 && (
              <Button
                className="mt-4"
                render={<Link href="/production/orders/new" />}
              >
                <Plus aria-hidden="true" />
                إنشاء أول أمر
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الأمر</TableHead>
                  <TableHead>المنتج النهائي</TableHead>
                  <TableHead>الكمية المخططة</TableHead>
                  <TableHead>فترة الإنتاج</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell dir="ltr" className="font-mono text-xs">
                      <Link
                        href={`/production/orders/${order.id}`}
                        className="text-sky-300 hover:text-sky-200 hover:underline"
                      >
                        {order.number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.product}
                    </TableCell>
                    <TableCell>
                      {numberFormatter.format(order.quantity)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-slate-300">
                      {dateFormatter.format(
                        new Date(`${order.plannedStartDate}T12:00:00`),
                      )}{" "}
                      –{" "}
                      {dateFormatter.format(
                        new Date(`${order.expectedCompletionDate}T12:00:00`),
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={PRODUCTION_STATUS_CLASSES[order.status]}
                      >
                        {PRODUCTION_STATUS_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}

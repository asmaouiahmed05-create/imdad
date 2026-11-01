"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DEMO_CUSTOMERS,
  SALES_STATUS_CLASSES,
  SALES_STATUS_LABELS,
  type SalesStatus,
} from "@/lib/sales-demo";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default function SalesOrdersPage() {
  const { orders, ready, error } = useSalesDemo();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SalesStatus>("ALL");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return orders.filter((order) => {
      const customer = DEMO_CUSTOMERS.find(
        (entry) => entry.id === order.customerId,
      );
      const matchesQuery =
        !normalizedQuery ||
        order.number.toLocaleLowerCase().includes(normalizedQuery) ||
        order.product.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        customer?.name.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        customer?.city.toLocaleLowerCase("ar").includes(normalizedQuery);
      return (
        matchesQuery &&
        (statusFilter === "ALL" || order.status === statusFilter)
      );
    });
  }, [orders, query, statusFilter]);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/sales"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
            لوحة المبيعات
          </Link>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            المبيعات
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            طلبات العملاء
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            ابحث في الطلبات التجريبية وصفّها حسب الحالة.
          </p>
        </div>
        <Button render={<Link href="/sales/orders/new" />}>
          <Plus aria-hidden="true" />
          طلب جديد
        </Button>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
            <ClipboardList aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              قائمة الطلبات
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              افتح أي طلب لعرض تفاصيله وتحديث حالته.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">ابحث برقم الطلب أو العميل أو المنتج</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث برقم الطلب أو العميل أو المنتج..."
              className="h-10 border-white/[0.08] bg-slate-950 ps-10"
            />
          </label>
          <label className="sr-only" htmlFor="sales-status-filter">
            تصفية حسب الحالة
          </label>
          <select
            id="sales-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | SalesStatus)
            }
            className="h-10 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="ALL">كل الحالات</option>
            {Object.entries(SALES_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {!ready ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            جارٍ تحميل الطلبات...
          </p>
        ) : filteredOrders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">
              {orders.length === 0
                ? "لا توجد طلبات بعد."
                : "لا توجد طلبات تطابق البحث."}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {orders.length === 0
                ? "أنشئ طلبًا تجريبيًا ليظهر هنا."
                : "جرّب تغيير عبارة البحث أو الحالة."}
            </p>
            {orders.length === 0 && (
              <Button
                className="mt-4"
                render={<Link href="/sales/orders/new" />}
              >
                <Plus aria-hidden="true" />
                إنشاء أول طلب
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-start text-sm">
              <thead className="bg-white/[0.02] text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">رقم الطلب</th>
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">المنتج</th>
                  <th className="px-5 py-3 font-medium">الكمية</th>
                  <th className="px-5 py-3 font-medium">التسليم المتوقع</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredOrders.map((order) => {
                  const customer = DEMO_CUSTOMERS.find(
                    (entry) => entry.id === order.customerId,
                  );
                  return (
                    <tr key={order.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4 font-mono text-xs" dir="ltr">
                        <Link
                          href={`/sales/orders/${order.id}`}
                          className="text-sky-300 hover:text-sky-200 hover:underline"
                        >
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-200">
                        {customer?.name ?? "عميل غير معروف"}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {order.product}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {numberFormatter.format(order.quantity)}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {dateFormatter.format(
                          new Date(`${order.expectedDeliveryDate}T12:00:00`),
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={SALES_STATUS_CLASSES[order.status]}
                        >
                          {SALES_STATUS_LABELS[order.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDistributionDemo } from "@/components/distribution/DistributionDemoProvider";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DELIVERY_STATUS_CLASSES,
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
} from "@/lib/delivery-demo";
import { DEMO_CUSTOMERS } from "@/lib/sales-demo";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default function DeliveriesPage() {
  const { deliveries, ready, error } = useDistributionDemo();
  const { orders, error: ordersError } = useSalesDemo();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | DeliveryStatus>(
    "ALL",
  );
  const filteredDeliveries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return deliveries.filter((delivery) => {
      const order = orders.find((item) => item.id === delivery.orderId);
      const customer = DEMO_CUSTOMERS.find(
        (item) => item.id === delivery.customerId,
      );
      const matchesQuery =
        !normalizedQuery ||
        delivery.reference.toLocaleLowerCase().includes(normalizedQuery) ||
        delivery.address.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        order?.number.toLocaleLowerCase().includes(normalizedQuery) ||
        customer?.name.toLocaleLowerCase("ar").includes(normalizedQuery);
      return (
        matchesQuery &&
        (statusFilter === "ALL" || delivery.status === statusFilter)
      );
    });
  }, [deliveries, orders, query, statusFilter]);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/distribution"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
            لوحة التوزيع
          </Link>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التوزيع
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            سجلات التوصيل
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            ابحث في سجلات التوصيل وصفّها حسب الحالة.
          </p>
        </div>
        <Button render={<Link href="/distribution/deliveries/new" />}>
          <Plus aria-hidden="true" />
          سجل توصيل جديد
        </Button>
      </section>

      {(error || ordersError) && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error || ordersError}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
            <Truck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              قائمة التوصيل
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              كل سجل مرتبط بطلب عميل موجود.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">
              ابحث برقم التوصيل أو الطلب أو العميل أو العنوان
            </span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث برقم التوصيل أو الطلب أو العميل أو العنوان..."
              className="h-10 border-white/[0.08] bg-slate-950 ps-10"
            />
          </label>
          <label className="sr-only" htmlFor="delivery-status-filter">
            تصفية حسب حالة التوصيل
          </label>
          <select
            id="delivery-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | DeliveryStatus)
            }
            className="h-10 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="ALL">كل الحالات</option>
            {Object.entries(DELIVERY_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {!ready ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            جارٍ تحميل سجلات التوصيل...
          </p>
        ) : filteredDeliveries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">
              {deliveries.length === 0
                ? "لا توجد سجلات توصيل بعد."
                : "لا توجد سجلات تطابق البحث."}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {deliveries.length === 0
                ? "ابدأ بإنشاء سجل من طلب مؤكد أو جاهز للتسليم."
                : "جرّب تغيير عبارة البحث أو الحالة."}
            </p>
            {deliveries.length === 0 && (
              <Button
                className="mt-4"
                render={<Link href="/distribution/deliveries/new" />}
              >
                <Plus aria-hidden="true" />
                إنشاء أول سجل توصيل
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead className="bg-white/[0.02] text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">مرجع التوصيل</th>
                  <th className="px-5 py-3 font-medium">طلب العميل</th>
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">تاريخ التوصيل</th>
                  <th className="px-5 py-3 font-medium">العنوان</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredDeliveries.map((delivery) => {
                  const order = orders.find(
                    (item) => item.id === delivery.orderId,
                  );
                  const customer = DEMO_CUSTOMERS.find(
                    (item) => item.id === delivery.customerId,
                  );
                  return (
                    <tr
                      key={delivery.id}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4 font-mono text-xs" dir="ltr">
                        <Link
                          href={`/distribution/deliveries/${delivery.id}`}
                          className="text-sky-300 hover:text-sky-200 hover:underline"
                        >
                          {delivery.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-300" dir="ltr">
                        {order ? (
                          <Link
                            href={`/sales/orders/${order.id}`}
                            className="hover:text-sky-300"
                          >
                            {order.number}
                          </Link>
                        ) : (
                          "طلب غير متاح"
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-200">
                        {customer?.name ?? "عميل غير معروف"}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {dateFormatter.format(
                          new Date(`${delivery.deliveryDate}T12:00:00`),
                        )}
                      </td>
                      <td className="max-w-64 truncate px-5 py-4 text-slate-300">
                        {delivery.address}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={DELIVERY_STATUS_CLASSES[delivery.status]}
                        >
                          {DELIVERY_STATUS_LABELS[delivery.status]}
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

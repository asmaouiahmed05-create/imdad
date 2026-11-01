"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  MapPinned,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { useDistributionDemo } from "@/components/distribution/DistributionDemoProvider";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DELIVERY_STATUS_CLASSES,
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
} from "@/lib/delivery-demo";
import { DEMO_CUSTOMERS } from "@/lib/sales-demo";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default function DistributionPage() {
  const {
    orders,
    ready: ordersReady,
    error: ordersError,
  } = useSalesDemo();
  const { deliveries, ready, error } = useDistributionDemo();
  const countByStatus = (status: DeliveryStatus) =>
    deliveries.filter((delivery) => delivery.status === status).length;
  const eligibleOrders = orders.filter(
    (order) => order.status === "CONFIRMED" || order.status === "READY",
  );
  const availableOrders = eligibleOrders.filter(
    (order) => !deliveries.some((delivery) => delivery.orderId === order.id),
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التوزيع
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            لوحة التوزيع والتوصيل
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            اربط طلبات العملاء المؤكدة بسجلات التوصيل التجريبية.
          </p>
        </div>
        <Button
          render={
            <Link
              href={
                availableOrders[0]
                  ? `/distribution/deliveries/new?order=${encodeURIComponent(availableOrders[0].id)}`
                  : "/distribution/deliveries/new"
              }
            />
          }
        >
          <Plus aria-hidden="true" />
          إنشاء سجل توصيل
        </Button>
      </section>

      <p
        role="note"
        className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200"
      >
        نموذج تجريبي: تُحفظ بيانات التوصيل في هذا المتصفح فقط. لا توجد خرائط أو
        تتبع GPS أو معالجة دفع، ولا تتغير كميات المخزون أو حركاته.
      </p>
      {(error || ordersError) && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error || ordersError}
        </p>
      )}

      <section
        aria-label="ملخص عمليات التوصيل"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="إجمالي سجلات التوصيل"
          value={ready ? numberFormatter.format(deliveries.length) : "—"}
          icon={ClipboardList}
          accent="blue"
        />
        <StatCard
          label="قيد الانتظار"
          value={ready ? numberFormatter.format(countByStatus("PENDING")) : "—"}
          icon={Clock3}
          accent="violet"
        />
        <StatCard
          label="خرجت للتوصيل"
          value={
            ready ? numberFormatter.format(countByStatus("OUT_FOR_DELIVERY")) : "—"
          }
          icon={Truck}
          accent="amber"
        />
        <StatCard
          label="تم التسليم"
          value={
            ready ? numberFormatter.format(countByStatus("DELIVERED")) : "—"
          }
          icon={PackageCheck}
          accent="emerald"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
                <MapPinned aria-hidden="true" className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  الطلبات الجاهزة للتوزيع
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  الطلبات المؤكدة أو الجاهزة للتسليم.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-white/10 bg-slate-900 px-3 py-2 text-slate-300"
            >
              {ordersReady ? numberFormatter.format(eligibleOrders.length) : "—"}{" "}
              طلب
            </Badge>
          </div>
          {!ordersReady ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              جارٍ تحميل طلبات العملاء...
            </p>
          ) : eligibleOrders.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-medium text-slate-200">
                لا توجد طلبات مؤكدة أو جاهزة للتسليم.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                أكّد طلب عميل أو جهّزه للتسليم أولًا.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                render={<Link href="/sales/orders" />}
              >
                فتح طلبات العملاء
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {eligibleOrders.map((order) => {
                const customer = DEMO_CUSTOMERS.find(
                  (entry) => entry.id === order.customerId,
                );
                const delivery = deliveries.find(
                  (item) => item.orderId === order.id,
                );
                return (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/sales/orders/${order.id}`}
                        className="font-mono text-xs text-sky-300 hover:underline"
                        dir="ltr"
                      >
                        {order.number}
                      </Link>
                      <p className="mt-1 truncate text-sm font-medium text-white">
                        {customer?.name ?? "عميل غير معروف"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {order.product} · {order.quantity} قطعة
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {delivery ? (
                        <>
                          <Badge
                            variant="outline"
                            className={DELIVERY_STATUS_CLASSES[delivery.status]}
                          >
                            {DELIVERY_STATUS_LABELS[delivery.status]}
                          </Badge>
                          <Button
                            variant="outline"
                            render={
                              <Link href={`/distribution/deliveries/${delivery.id}`} />
                            }
                          >
                            تفاصيل التوصيل
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge
                            variant="outline"
                            className="border-white/10 bg-slate-900 text-slate-300"
                          >
                            {order.status === "READY" ? "جاهز للتسليم" : "مؤكد"}
                          </Badge>
                          <Button
                            render={
                              <Link
                                href={`/distribution/deliveries/new?order=${encodeURIComponent(order.id)}`}
                              />
                            }
                          >
                            إنشاء توصيل
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                أحدث سجلات التوصيل
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                متابعة تقدم عمليات التوصيل.
              </p>
            </div>
            <Link
              href="/distribution/deliveries"
              className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
            >
              الكل <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {!ready ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              جارٍ تحميل سجلات التوصيل...
            </p>
          ) : deliveries.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-medium text-slate-200">
                لا توجد سجلات توصيل بعد.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                أنشئ سجلًا من أحد الطلبات الجاهزة.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {deliveries.slice(0, 4).map((delivery) => {
                const order = orders.find(
                  (item) => item.id === delivery.orderId,
                );
                return (
                  <Link
                    key={delivery.id}
                    href={`/distribution/deliveries/${delivery.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="font-mono text-xs text-sky-300" dir="ltr">
                        {delivery.reference}
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {order?.number ?? "طلب غير متاح"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {dateFormatter.format(
                          new Date(`${delivery.deliveryDate}T12:00:00`),
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={DELIVERY_STATUS_CLASSES[delivery.status]}
                    >
                      {DELIVERY_STATUS_LABELS[delivery.status]}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {ready && availableOrders.length === 0 && eligibleOrders.length > 0 && (
        <p className="text-center text-xs text-slate-500">
          لكل الطلبات المؤهلة سجل توصيل.{" "}
          <Link
            href="/distribution/deliveries"
            className="text-sky-300 hover:underline"
          >
            استعراض السجلات
          </Link>
        </p>
      )}
    </main>
  );
}

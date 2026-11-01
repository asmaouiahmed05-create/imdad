"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, CircleX, PackageCheck, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDistributionDemo } from "@/components/distribution/DistributionDemoProvider";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DEMO_DRIVERS,
  DELIVERY_STATUS_CLASSES,
  DELIVERY_STATUS_LABELS,
  getNextDeliveryStatus,
  type DeliveryStatus,
} from "@/lib/delivery-demo";
import { DEMO_CUSTOMERS } from "@/lib/sales-demo";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "long",
  timeZone: "Africa/Algiers",
});

export function DeliveryDetail({ deliveryId }: { deliveryId: string }) {
  const { deliveries, ready, error, updateStatus } = useDistributionDemo();
  const { orders, error: ordersError } = useSalesDemo();
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const delivery = deliveries.find((item) => item.id === deliveryId);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
        <p role="status" className="text-sm text-slate-400">
          جارٍ تحميل تفاصيل التوصيل...
        </p>
      </main>
    );
  }

  if (!delivery) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <Link
          href="/distribution/deliveries"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
          سجلات التوصيل
        </Link>
        <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-6">
          <h2 className="text-lg font-semibold text-white">
            لم يتم العثور على سجل التوصيل
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            ربما حُذفت بيانات العرض المحلية أو لم يعد هذا السجل موجودًا.
          </p>
          {(error || ordersError) && (
            <p role="alert" className="mt-4 text-sm text-rose-300">
              {error || ordersError}
            </p>
          )}
        </section>
      </main>
    );
  }

  const currentDelivery = delivery;
  const order = orders.find((item) => item.id === currentDelivery.orderId);
  const customer = DEMO_CUSTOMERS.find(
    (item) => item.id === currentDelivery.customerId,
  );
  const driver = DEMO_DRIVERS.find(
    (item) => item.id === currentDelivery.driverId,
  );
  const nextStatus = getNextDeliveryStatus(currentDelivery.status);

  function updateTo(status: DeliveryStatus, message: string) {
    setActionError("");
    setActionMessage("");
    try {
      updateStatus(currentDelivery.id, status);
      setActionMessage(message);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "تعذّر تحديث حالة التوصيل.",
      );
    }
  }

  const nextAction =
    currentDelivery.status === "PENDING"
      ? { label: "بدء تجهيز الطلب", icon: PackageCheck }
      : currentDelivery.status === "PREPARING"
        ? { label: "تسجيل الخروج للتوصيل", icon: Play }
        : currentDelivery.status === "OUT_FOR_DELIVERY"
          ? { label: "تسجيل التسليم التجريبي", icon: Check }
          : null;
  const NextActionIcon = nextAction?.icon;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/distribution/deliveries"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        سجلات التوصيل
      </Link>

      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
              تفاصيل سجل التوصيل التجريبي
            </p>
            <h2
              className="font-mono text-xl font-semibold text-white"
              dir="ltr"
            >
              {currentDelivery.reference}
            </h2>
          </div>
          <Badge
            variant="outline"
            className={DELIVERY_STATUS_CLASSES[currentDelivery.status]}
          >
            {DELIVERY_STATUS_LABELS[currentDelivery.status]}
          </Badge>
        </div>

        <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
          تحديث الحالة للتوضيح فقط؛ لا يفعّل خرائط أو تتبعًا مباشرًا ولا يؤكد
          التسليم الفعلي.
        </p>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">طلب العميل المرتبط</dt>
            <dd className="mt-2 font-mono text-sm text-sky-300" dir="ltr">
              {order ? (
                <Link
                  href={`/sales/orders/${order.id}`}
                  className="hover:underline"
                >
                  {order.number}
                </Link>
              ) : (
                "طلب غير متاح"
              )}
            </dd>
            {order && (
              <dd className="mt-1 text-sm text-slate-300">
                {order.product} · {order.quantity} قطعة
              </dd>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">العميل</dt>
            <dd className="mt-2 font-medium text-white">
              {customer?.name ?? "عميل غير معروف"}
            </dd>
            {customer && (
              <dd className="mt-1 text-sm text-slate-400">
                {customer.city} · {customer.phone}
              </dd>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <dt className="text-xs text-slate-400">عنوان التسليم</dt>
            <dd className="mt-2 font-medium text-white">
              {currentDelivery.address}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">تاريخ التوصيل</dt>
            <dd className="mt-2 font-medium text-white">
              {dateFormatter.format(
                new Date(`${currentDelivery.deliveryDate}T12:00:00`),
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">السائق المكلّف</dt>
            <dd className="mt-2 font-medium text-white">
              {driver?.name ?? "سائق غير معروف"}
            </dd>
            {driver && (
              <dd className="mt-1 text-sm text-slate-400" dir="ltr">
                {driver.phone}
              </dd>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <dt className="text-xs text-slate-400">ملاحظات التوصيل</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {currentDelivery.notes || "لا توجد ملاحظات."}
            </dd>
          </div>
        </dl>

        {(error || ordersError || actionError) && (
          <p role="alert" className="mt-5 text-sm text-rose-300">
            {actionError || error || ordersError}
          </p>
        )}
        {actionMessage && (
          <p
            role="status"
            className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-200"
          >
            {actionMessage}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {nextAction && NextActionIcon && nextStatus && (
            <Button
              type="button"
              onClick={() =>
                updateTo(
                  nextStatus,
                  `تم تحديث حالة التوصيل إلى ${DELIVERY_STATUS_LABELS[nextStatus]}.`,
                )
              }
            >
              <NextActionIcon aria-hidden="true" />
              {nextAction.label}
            </Button>
          )}
          {currentDelivery.status !== "DELIVERED" &&
            currentDelivery.status !== "FAILED" && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateTo("FAILED", "تم تسجيل تعذّر التسليم في العرض التجريبي.")
                }
              >
                <CircleX aria-hidden="true" />
                تسجيل تعذّر التسليم
              </Button>
            )}
          <Button
            type="button"
            variant="outline"
            render={<Link href="/distribution/deliveries" />}
          >
            العودة إلى القائمة
          </Button>
        </div>
      </section>
    </main>
  );
}

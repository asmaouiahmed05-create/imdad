"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, CircleX, PackageCheck, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDistributionDemo } from "@/components/distribution/DistributionDemoProvider";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  canCreateDelivery,
  DELIVERY_STATUS_CLASSES,
  DELIVERY_STATUS_LABELS,
} from "@/lib/delivery-demo";
import {
  DEMO_CUSTOMERS,
  getNextSalesStatus,
  SALES_STATUS_CLASSES,
  SALES_STATUS_LABELS,
  type SalesStatus,
} from "@/lib/sales-demo";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "long",
  timeZone: "Africa/Algiers",
});

export function SalesOrderDetail({ orderId }: { orderId: string }) {
  const { orders, ready, error, updateStatus } = useSalesDemo();
  const {
    deliveries,
    ready: deliveriesReady,
    error: deliveryError,
  } = useDistributionDemo();
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const order = orders.find((candidate) => candidate.id === orderId);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
        <p role="status" className="text-sm text-slate-400">
          جارٍ تحميل تفاصيل الطلب...
        </p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <Link
          href="/sales/orders"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
          طلبات العملاء
        </Link>
        <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-6">
          <h2 className="text-lg font-semibold text-white">
            لم يتم العثور على طلب العميل
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            ربما حُذفت بيانات العرض المحلية أو لم يعد هذا الطلب موجودًا.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-rose-300">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  const currentOrder = order;
  const customer = DEMO_CUSTOMERS.find(
    (entry) => entry.id === currentOrder.customerId,
  );
  const delivery = deliveries.find((item) => item.orderId === currentOrder.id);
  const nextStatus = getNextSalesStatus(currentOrder.status);

  function updateTo(status: SalesStatus, message: string) {
    setActionError("");
    setActionMessage("");
    try {
      updateStatus(currentOrder.id, status);
      setActionMessage(message);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "تعذّر تحديث حالة العرض.",
      );
    }
  }

  const nextAction =
    currentOrder.status === "NEW"
      ? { label: "تأكيد الطلب", icon: Check }
      : currentOrder.status === "CONFIRMED"
        ? { label: "بدء التحضير", icon: Play }
        : currentOrder.status === "PREPARING"
          ? { label: "تجهيزه للتسليم", icon: PackageCheck }
          : currentOrder.status === "READY"
            ? { label: "تسجيل التسليم التجريبي", icon: Check }
            : null;
  const NextActionIcon = nextAction?.icon;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/sales/orders"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        طلبات العملاء
      </Link>

      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
              تفاصيل طلب العميل التجريبي
            </p>
            <h2 className="font-mono text-xl font-semibold text-white" dir="ltr">
              {currentOrder.number}
            </h2>
          </div>
          <Badge
            variant="outline"
            className={SALES_STATUS_CLASSES[currentOrder.status]}
          >
            {SALES_STATUS_LABELS[currentOrder.status]}
          </Badge>
        </div>

        <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
          تحديث الحالة للعرض فقط. لا ينفّذ تسليمًا أو دفعًا فعليًا ولا يغيّر
          كميات المخزون أو حركاته.
        </p>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
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
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">المنتج والكمية</dt>
            <dd className="mt-2 font-medium text-white">
              {currentOrder.product}
            </dd>
            <dd className="mt-1 text-sm text-slate-400">
              {numberFormatter.format(currentOrder.quantity)} قطعة
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">تاريخ الطلب</dt>
            <dd className="mt-2 font-medium text-white">
              {dateFormatter.format(new Date(`${currentOrder.orderDate}T12:00:00`))}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">التسليم المتوقع</dt>
            <dd className="mt-2 font-medium text-white">
              {dateFormatter.format(
                new Date(`${currentOrder.expectedDeliveryDate}T12:00:00`),
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <dt className="text-xs text-slate-400">ملاحظات</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {currentOrder.notes || "لا توجد ملاحظات."}
            </dd>
          </div>
        </dl>

        <section
          aria-label="حالة التوصيل المرتبطة"
          className="mt-5 rounded-xl border border-white/[0.07] bg-slate-950/60 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">حالة التوصيل</p>
              {delivery ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={DELIVERY_STATUS_CLASSES[delivery.status]}
                  >
                    {DELIVERY_STATUS_LABELS[delivery.status]}
                  </Badge>
                  <span className="font-mono text-xs text-slate-400" dir="ltr">
                    {delivery.reference}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-300">
                  {deliveriesReady
                    ? "لا يوجد سجل توصيل مرتبط بهذا الطلب."
                    : "جارٍ تحميل حالة التوصيل..."}
                </p>
              )}
            </div>
            {delivery ? (
              <Button
                variant="outline"
                render={
                  <Link href={`/distribution/deliveries/${delivery.id}`} />
                }
              >
                تفاصيل التوصيل
              </Button>
            ) : (
              canCreateDelivery(currentOrder) && (
                <Button
                  variant="outline"
                  render={
                    <Link
                      href={`/distribution/deliveries/new?order=${encodeURIComponent(currentOrder.id)}`}
                    />
                  }
                >
                  إنشاء سجل توصيل
                </Button>
              )
            )}
          </div>
        </section>

        {(error || actionError || deliveryError) && (
          <p role="alert" className="mt-5 text-sm text-rose-300">
            {actionError || error || deliveryError}
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
                updateTo(nextStatus, `تم تحديث حالة الطلب إلى ${SALES_STATUS_LABELS[nextStatus]}.`)
              }
            >
              <NextActionIcon aria-hidden="true" />
              {nextAction.label}
            </Button>
          )}
          {currentOrder.status !== "DELIVERED" &&
            currentOrder.status !== "CANCELLED" && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                updateTo("CANCELLED", "تم إلغاء الطلب في العرض التجريبي.")
              }
            >
              <CircleX aria-hidden="true" />
              إلغاء الطلب
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            render={<Link href="/sales/orders" />}
          >
            العودة إلى القائمة
          </Button>
        </div>
      </section>
    </main>
  );
}

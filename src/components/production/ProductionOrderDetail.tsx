"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Play } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProductionDemo } from "@/components/production/ProductionDemoProvider";
import {
  getNextProductionStatus,
  PRODUCTION_STATUS_CLASSES,
  PRODUCTION_STATUS_LABELS,
} from "@/lib/production-demo";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "long",
  timeZone: "Africa/Algiers",
});

export function ProductionOrderDetail({ orderId }: { orderId: string }) {
  const { orders, ready, error, updateStatus } = useProductionDemo();
  const [actionError, setActionError] = useState("");
  const order = orders.find((candidate) => candidate.id === orderId);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
        <p role="status" className="text-sm text-slate-400">
          جارٍ تحميل تفاصيل أمر العرض...
        </p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <Link
          href="/production"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
          قائمة الإنتاج
        </Link>
        <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-6">
          <h2 className="text-lg font-semibold text-white">
            لم يتم العثور على أمر الإنتاج
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            ربما حُذفت بيانات العرض المحلية أو لم يعد هذا الأمر موجودًا.
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
  const nextStatus = getNextProductionStatus(currentOrder.status);

  function advanceStatus() {
    if (!nextStatus) return;
    setActionError("");
    try {
      updateStatus(currentOrder.id, nextStatus);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "تعذّر تحديث حالة العرض.",
      );
    }
  }

  const nextAction =
    currentOrder.status === "DRAFT"
      ? { label: "اعتماد التخطيط", icon: CalendarDays }
      : currentOrder.status === "PLANNED"
        ? { label: "بدء العرض التجريبي", icon: Play }
        : currentOrder.status === "IN_PROGRESS"
          ? { label: "تسجيل اكتمال العرض", icon: Check }
          : null;
  const NextActionIcon = nextAction?.icon;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/production"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        قائمة الإنتاج
      </Link>

      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
              تفاصيل أمر الإنتاج التجريبي
            </p>
            <h2 className="font-mono text-xl font-semibold text-white" dir="ltr">
              {currentOrder.number}
            </h2>
          </div>
          <Badge
            variant="outline"
            className={PRODUCTION_STATUS_CLASSES[currentOrder.status]}
          >
            {PRODUCTION_STATUS_LABELS[currentOrder.status]}
          </Badge>
        </div>

        <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
          تغيير الحالة للتوضيح فقط؛ لا يمثّل تنفيذًا فعليًا ولا يغيّر المخزون.
        </p>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">المنتج النهائي</dt>
            <dd className="mt-2 font-medium text-white">{currentOrder.product}</dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">الكمية المخططة</dt>
            <dd className="mt-2 font-medium text-white">
              {numberFormatter.format(currentOrder.quantity)} قطعة
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">تاريخ بدء الإنتاج</dt>
            <dd className="mt-2 font-medium text-white">
              {dateFormatter.format(
                new Date(`${currentOrder.plannedStartDate}T12:00:00`),
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">الإنجاز المتوقع</dt>
            <dd className="mt-2 font-medium text-white">
              {dateFormatter.format(
                new Date(`${currentOrder.expectedCompletionDate}T12:00:00`),
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

        {(error || actionError) && (
          <p role="alert" className="mt-5 text-sm text-rose-300">
            {actionError || error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {nextAction && NextActionIcon && (
            <Button type="button" onClick={advanceStatus}>
              <NextActionIcon aria-hidden="true" />
              {nextAction.label}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            render={<Link href="/production" />}
          >
            العودة إلى القائمة
          </Button>
        </div>
      </section>
    </main>
  );
}

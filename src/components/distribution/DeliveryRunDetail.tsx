"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelDeliveryRun, dispatchDeliveryRun } from "@/app/distribution/actions";
import { Button } from "@/components/ui/button";
import {
  DELIVERY_PRIORITY_LABELS,
  DELIVERY_RUN_STATUS_LABELS,
  DELIVERY_SHIPMENT_STATUS_CLASSES,
  DELIVERY_SHIPMENT_STATUS_LABELS,
  type DeliveryPriority,
  type DeliveryRunStatus,
  type DeliveryShipmentStatus,
} from "@/lib/delivery-state";

type Run = {
  id: string;
  runNumber: string;
  region: string;
  priority: DeliveryPriority;
  scheduledAt: Date;
  status: DeliveryRunStatus;
  dispatchedAt: Date | null;
  completedAt: Date | null;
  driver: { name: string; phone: string };
  vehicle: { plate: string; label: string; maxStops: number };
  shipments: {
    id: string;
    reference: string;
    status: DeliveryShipmentStatus;
    customerName: string;
    address: string;
    region: string;
    expectedDeliveryAt: Date;
    order: { orderNumber: string };
  }[];
};

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
const dateTimeFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});

export function DeliveryRunDetail({
  run: deliveryRun,
  canManage,
}: {
  run: Run;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function perform(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "تعذّر تحديث المسار.");
          return;
        }
        router.refresh();
      } catch {
        setError("تعذّر الاتصال بالخادم. تحقّق من المسار ثم حاول مجددًا.");
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href="/distribution/runs" className="text-sm text-slate-400 hover:text-white">← مسارات التوصيل</Link>
      <section className="space-y-5 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">مسار توزيع</p><h1 className="font-mono text-xl font-semibold text-white" dir="ltr">{deliveryRun.runNumber}</h1></div>
          <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1 text-xs text-sky-200">{DELIVERY_RUN_STATUS_LABELS[deliveryRun.status]}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><p className="text-xs text-slate-400">المنطقة / الموعد</p><p className="mt-2 text-sm text-white">{deliveryRun.region}</p><p className="mt-1 text-xs text-slate-400">{dateFormatter.format(deliveryRun.scheduledAt)}</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><p className="text-xs text-slate-400">الأولوية</p><p className="mt-2 text-sm text-white">{DELIVERY_PRIORITY_LABELS[deliveryRun.priority]}</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><p className="text-xs text-slate-400">السائق</p><p className="mt-2 text-sm text-white">{deliveryRun.driver.name}</p><p className="mt-1 text-xs text-slate-400" dir="ltr">{deliveryRun.driver.phone}</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><p className="text-xs text-slate-400">المركبة / سعة التوقفات</p><p className="mt-2 text-sm text-white">{deliveryRun.vehicle.label} · {deliveryRun.vehicle.plate}</p><p className="mt-1 text-xs text-slate-400">{deliveryRun.vehicle.maxStops} توقفات</p></div>
        </div>
        {deliveryRun.dispatchedAt && <p className="text-sm text-slate-300">أُرسل {dateTimeFormatter.format(deliveryRun.dispatchedAt)}</p>}
        {deliveryRun.completedAt && <p className="text-sm text-emerald-300">اكتمل {dateTimeFormatter.format(deliveryRun.completedAt)}</p>}
        <div className="flex flex-wrap gap-2">
          {canManage && deliveryRun.status === "PLANNED" && (
            <>
              <Button disabled={pending} onClick={() => perform(() => dispatchDeliveryRun(deliveryRun.id))}>إرسال المسار والشحنات الجاهزة</Button>
              {deliveryRun.shipments.length === 0 && <Button variant="outline" disabled={pending} onClick={() => perform(() => cancelDeliveryRun(deliveryRun.id))}>إلغاء المسار الفارغ</Button>}
            </>
          )}
          {canManage && deliveryRun.status === "PLANNED" && <Button variant="outline" render={<Link href="/distribution/deliveries" />}>استعراض الشحنات الجاهزة</Button>}
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">{error}</p>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4"><div><h2 className="font-semibold text-white">توقفات المسار</h2><p className="mt-1 text-xs text-slate-400">{deliveryRun.shipments.length} / {deliveryRun.vehicle.maxStops} توقفات مخططة</p></div><Link href="/distribution/deliveries" className="text-sm text-sky-300 hover:underline">الشحنات</Link></div>
        {deliveryRun.shipments.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">لا توجد شحنات مسندة. افتح شحنة جاهزة في منطقة {deliveryRun.region} لإسنادها.</p> : (
          <ul className="divide-y divide-white/[0.05]">{deliveryRun.shipments.map((shipment) => (
            <li key={shipment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div><Link href={`/distribution/deliveries/${shipment.id}`} className="font-mono text-sm text-sky-300 hover:underline" dir="ltr">{shipment.reference}</Link><p className="mt-1 text-sm text-white">{shipment.customerName} · {shipment.address}</p><p className="mt-1 text-xs text-slate-400">{shipment.order.orderNumber} · موعد {dateFormatter.format(shipment.expectedDeliveryAt)}</p></div>
              <span className={`rounded-full border px-3 py-1 text-xs ${DELIVERY_SHIPMENT_STATUS_CLASSES[shipment.status]}`}>{DELIVERY_SHIPMENT_STATUS_LABELS[shipment.status]}</span>
            </li>
          ))}</ul>
        )}
      </section>
    </main>
  );
}

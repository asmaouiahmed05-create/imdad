"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignDeliveryShipmentToRun,
  confirmDeliveryReceived,
  failDeliveryAttempt,
  markDeliveryShipmentReady,
  rescheduleDelivery,
  startDeliveryTransit,
} from "@/app/distribution/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DELIVERY_RUN_STATUS_LABELS,
  DELIVERY_SHIPMENT_STATUS_CLASSES,
  DELIVERY_SHIPMENT_STATUS_LABELS,
  type DeliveryShipmentStatus,
} from "@/lib/delivery-state";

type Shipment = {
  id: string;
  reference: string;
  status: DeliveryShipmentStatus;
  customerName: string;
  customerPhone: string | null;
  region: string;
  address: string;
  expectedDeliveryAt: Date;
  receiverName: string | null;
  deliveredAt: Date | null;
  failedReason: string | null;
  notes: string | null;
  createdAt: Date;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    fulfilledAt: Date | null;
    lines: {
      id: string;
      productName: string;
      productSku: string;
      unit: string;
      orderedQuantity: number;
    }[];
  };
  run: {
    id: string;
    runNumber: string;
    status: "PLANNED" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
    driver: { name: string; phone: string };
    vehicle: { plate: string; label: string };
  } | null;
  events: {
    id: string;
    type: string;
    fromStatus: DeliveryShipmentStatus | null;
    toStatus: DeliveryShipmentStatus | null;
    reason: string | null;
    receiverName: string | null;
    expectedDeliveryAt: Date | null;
    createdAt: Date;
    actor: { name: string };
    run: { runNumber: string } | null;
  }[];
};

type AvailableRun = { id: string; runNumber: string; remainingStops: number };

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
const dateTimeFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});

function localDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
  }).format(value);
}

function tomorrowLocalDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localDate(tomorrow);
}

function EventTitle({ type }: { type: string }) {
  const labels: Record<string, string> = {
    CREATED: "إنشاء الشحنة",
    STATUS_CHANGED: "تغيير حالة الشحنة",
    ASSIGNED_TO_RUN: "إسناد إلى مسار",
    RESCHEDULED: "إعادة جدولة",
    RUN_DISPATCHED: "إرسال المسار",
  };
  return <>{labels[type] ?? "تحديث الشحنة"}</>;
}

function ShipmentActions({
  shipment,
  availableRuns,
  canManage,
}: {
  shipment: Shipment;
  availableRuns: AvailableRun[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "تعذّر تحديث الشحنة.");
          return;
        }
        setMessage("تم تحديث الشحنة.");
        router.refresh();
      } catch {
        setError("تعذّر الاتصال بالخادم. تحقّق من الحالة ثم حاول مجددًا.");
      }
    });
  }

  function submitForm(
    event: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => action(formData));
  }

  if (!canManage) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
      <h2 className="font-semibold text-white">إجراءات التوصيل</h2>
      {shipment.status === "PREPARING" && (
        <Button disabled={pending} onClick={() => run(() => markDeliveryShipmentReady(shipment.id))}>
          تأكيد جاهزية الشحنة
        </Button>
      )}
      {shipment.status === "READY_FOR_DISPATCH" && (
        <div className="space-y-4">
          {shipment.run ? (
            <p className="text-sm text-slate-300">
              المسار الحالي: <Link className="text-sky-300 hover:underline" href={`/distribution/runs/${shipment.run.id}`}>{shipment.run.runNumber}</Link>
            </p>
          ) : availableRuns.length > 0 ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              const runId = String(new FormData(event.currentTarget).get("runId") ?? "");
              run(() => assignDeliveryShipmentToRun(shipment.id, runId));
            }} className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="runId">إسناد إلى مسار مخطط</Label>
                <select id="runId" name="runId" required defaultValue="" className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100">
                  <option value="" disabled>اختر مسارًا لمنطقة {shipment.region}</option>
                  {availableRuns.map((deliveryRun) => (
                    <option key={deliveryRun.id} value={deliveryRun.id}>{deliveryRun.runNumber} · {deliveryRun.remainingStops} توقفات متاحة</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={pending}>إسناد</Button>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">لا يوجد مسار مخطط متاح لهذه المنطقة.</p>
              <Button variant="outline" render={<Link href={`/distribution/runs/new?region=${encodeURIComponent(shipment.region)}`} />}>تخطيط مسار</Button>
            </div>
          )}
        </div>
      )}
      {shipment.status === "DISPATCHED" && (
        <Button disabled={pending} onClick={() => run(() => startDeliveryTransit(shipment.id))}>
          بدء التوصيل
        </Button>
      )}
      {shipment.status === "IN_TRANSIT" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={(event) => submitForm(event, confirmDeliveryReceived)} className="space-y-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
            <h3 className="text-sm font-semibold text-emerald-200">تأكيد استلام العميل</h3>
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <div className="space-y-2"><Label htmlFor="receiverName">اسم المستلم *</Label><Input id="receiverName" name="receiverName" maxLength={160} required /></div>
            <div className="space-y-2"><Label htmlFor="deliveryNotes">ملاحظات التسليم</Label><Input id="deliveryNotes" name="deliveryNotes" maxLength={1000} /></div>
            <Button type="submit" disabled={pending}>تأكيد التسليم</Button>
          </form>
          <form onSubmit={(event) => submitForm(event, failDeliveryAttempt)} className="space-y-3 rounded-xl border border-rose-400/10 bg-rose-400/[0.03] p-4">
            <h3 className="text-sm font-semibold text-rose-200">تسجيل محاولة فاشلة</h3>
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <div className="space-y-2"><Label htmlFor="failureReason">سبب تعذّر التسليم *</Label><textarea id="failureReason" name="reason" minLength={3} maxLength={1000} required rows={3} className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100" /></div>
            <Button type="submit" variant="outline" disabled={pending}>حفظ المحاولة</Button>
          </form>
        </div>
      )}
      {shipment.status === "DELIVERY_FAILED" && (
        <form onSubmit={(event) => submitForm(event, rescheduleDelivery)} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="shipmentId" value={shipment.id} />
          <div className="space-y-2"><Label htmlFor="expectedDeliveryDate">موعد إعادة التوصيل *</Label><Input id="expectedDeliveryDate" name="expectedDeliveryDate" type="date" min={tomorrowLocalDate()} required /></div>
          <Button type="submit" disabled={pending}>إعادة الجدولة</Button>
          <p className="basis-full text-xs text-slate-500">تُعاد الشحنة نفسها إلى مرحلة الجاهزية؛ لا يُنشأ طلب أو خصم مخزون جديد.</p>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-200">{message}</p>}
    </section>
  );
}

export function ShipmentDetail({
  shipment,
  availableRuns,
  canManage,
}: {
  shipment: Shipment;
  availableRuns: AvailableRun[];
  canManage: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href="/distribution/deliveries" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">← الشحنات</Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">شحنة مرتبطة بطلب مكتمل</p><h1 className="font-mono text-xl font-semibold text-white" dir="ltr">{shipment.reference}</h1></div>
          <span className={`rounded-full border px-3 py-1 text-xs ${DELIVERY_SHIPMENT_STATUS_CLASSES[shipment.status]}`}>{DELIVERY_SHIPMENT_STATUS_LABELS[shipment.status]}</span>
        </div>
        <p className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/[0.04] px-4 py-3 text-sm leading-6 text-sky-100">
          الشحنة تغطي طلب العميل بالكامل، ولا تُسجل حركات مخزون. لا يدعم هذا المسار تقسيم الشحنة أو المرتجعات.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">طلب العميل</dt><dd className="mt-2"><Link href={`/sales/orders/${shipment.order.id}`} className="font-mono text-sm text-sky-300 hover:underline" dir="ltr">{shipment.order.orderNumber}</Link></dd><dd className="mt-1 text-sm text-slate-400">اكتمل {shipment.order.fulfilledAt ? dateTimeFormatter.format(shipment.order.fulfilledAt) : "—"}</dd></div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">العميل</dt><dd className="mt-2 font-medium text-white">{shipment.customerName}</dd><dd className="mt-1 text-sm text-slate-400">{shipment.customerPhone || "لا يوجد هاتف"}</dd></div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">المنطقة والعنوان</dt><dd className="mt-2 font-medium text-white">{shipment.region}</dd><dd className="mt-1 text-sm text-slate-300">{shipment.address}</dd></div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4"><dt className="text-xs text-slate-400">التسليم المتوقع</dt><dd className="mt-2 font-medium text-white">{dateFormatter.format(shipment.expectedDeliveryAt)}</dd>{shipment.deliveredAt && <dd className="mt-1 text-sm text-emerald-300">تم التسليم {dateTimeFormatter.format(shipment.deliveredAt)}</dd>}</div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2"><dt className="text-xs text-slate-400">أصناف الطلب بالكامل</dt><dd className="mt-3"><ul className="divide-y divide-white/[0.05]">{shipment.order.lines.map((line) => <li key={line.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="text-slate-200">{line.productName} <span className="font-mono text-xs text-slate-500" dir="ltr">{line.productSku}</span></span><span className="text-slate-300">{line.orderedQuantity} {line.unit}</span></li>)}</ul></dd></div>
          {shipment.run && <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2"><dt className="text-xs text-slate-400">مسار التوصيل</dt><dd className="mt-2"><Link href={`/distribution/runs/${shipment.run.id}`} className="font-mono text-sm text-sky-300 hover:underline">{shipment.run.runNumber}</Link> · {DELIVERY_RUN_STATUS_LABELS[shipment.run.status]}</dd><dd className="mt-1 text-sm text-slate-400">{shipment.run.driver.name} · {shipment.run.vehicle.label} ({shipment.run.vehicle.plate})</dd></div>}
          {shipment.failedReason && <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.03] p-4 sm:col-span-2"><dt className="text-xs text-rose-300">آخر سبب لتعذّر التسليم</dt><dd className="mt-2 text-sm text-rose-100">{shipment.failedReason}</dd></div>}
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2"><dt className="text-xs text-slate-400">ملاحظات الشحنة</dt><dd className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{shipment.notes || "لا توجد ملاحظات."}</dd></div>
        </dl>
        <ShipmentActions shipment={shipment} availableRuns={availableRuns} canManage={canManage} />
      </section>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
        <h2 className="font-semibold text-white">سجل التغييرات والتسليم</h2>
        {shipment.events.length === 0 ? <p className="mt-4 text-sm text-slate-400">لا توجد أحداث مسجلة.</p> : (
          <ol className="mt-4 space-y-3">{shipment.events.map((event) => (
            <li key={event.id} className="border-s-2 border-sky-400/25 ps-4">
              <div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium text-slate-200"><EventTitle type={event.type} />{event.toStatus && ` · ${DELIVERY_SHIPMENT_STATUS_LABELS[event.toStatus]}`}</p><time className="text-xs text-slate-500">{dateTimeFormatter.format(event.createdAt)}</time></div>
              <p className="mt-1 text-xs text-slate-400">{event.actor.name}{event.run ? ` · ${event.run.runNumber}` : ""}{event.receiverName ? ` · استلمها ${event.receiverName}` : ""}</p>
              {event.expectedDeliveryAt && <p className="mt-1 text-xs text-slate-400">موعد محدد: {dateFormatter.format(event.expectedDeliveryAt)}</p>}
              {event.reason && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{event.reason}</p>}
            </li>
          ))}</ol>
        )}
      </section>
    </main>
  );
}

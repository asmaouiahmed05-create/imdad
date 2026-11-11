"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeliveryShipment } from "@/app/distribution/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EligibleOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  lines: { productName: string; productSku: string; orderedQuantity: number; unit: string }[];
};

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

export function ShipmentCreateForm({
  orders,
  defaultOrderId,
}: {
  orders: EligibleOrder[];
  defaultOrderId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState(
    orders.some((order) => order.id === defaultOrderId) ? defaultOrderId! : "",
  );
  const selectedOrder = orders.find((order) => order.id === orderId);
  const [address, setAddress] = useState(selectedOrder?.address ?? "");
  const [region, setRegion] = useState(selectedOrder?.city ?? "");

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await createDeliveryShipment(formData);
        if (!result.ok || !result.id) {
          setError(result.error ?? "تعذّر إنشاء الشحنة.");
          return;
        }
        router.push(`/distribution/deliveries/${result.id}`);
        router.refresh();
      } catch {
        setError("تعذّر الاتصال بالخادم. تحقّق من الشحنة ثم حاول مجددًا.");
      }
    });
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm leading-6 text-sky-100">
          لا توجد طلبات مكتملة دون شحنة. أكمل طلب عميل أولًا؛ لا تُنشأ الشحنات
          من الطلبات المؤكدة أو المسودات.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/sales/orders")}
        >
          فتح طلبات العملاء
        </Button>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-6">
      <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm leading-6 text-emerald-100">
        تُنشأ شحنة واحدة للطلب المكتمل. التوصيل لا يغيّر المخزون ولا يسجل حركة
        صرف أخرى؛ كل تغيير في الحالة يُحفظ في سجل تدقيق.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="orderId">طلب العميل المكتمل *</Label>
          <select
            id="orderId"
            name="orderId"
            required
            value={orderId}
            onChange={(event) => {
              const nextId = event.target.value;
              const nextOrder = orders.find((order) => order.id === nextId);
              setOrderId(nextId);
              setAddress(nextOrder?.address ?? "");
              setRegion(nextOrder?.city ?? "");
            }}
            className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="" disabled>
              اختر طلبًا مكتملًا
            </option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber} — {order.customerName}
              </option>
            ))}
          </select>
        </div>
        {selectedOrder && (
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <p className="text-xs text-slate-400">الأصناف المشمولة بالكامل</p>
            {selectedOrder.lines.map((line) => (
              <p key={line.productSku} className="text-sm text-slate-200">
                {line.productName} · {line.orderedQuantity} {line.unit}
              </p>
            ))}
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">عنوان التسليم *</Label>
          <Input
            id="address"
            name="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={300}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">المنطقة / الولاية *</Label>
          <Input
            id="region"
            name="region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedDeliveryDate">موعد التسليم المتوقع *</Label>
          <Input
            id="expectedDeliveryDate"
            name="expectedDeliveryDate"
            type="date"
            min={localDate(new Date())}
            defaultValue={tomorrowLocalDate()}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">ملاحظات للسائق</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "إنشاء الشحنة"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/distribution/deliveries")}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDistributionDemo } from "@/components/distribution/DistributionDemoProvider";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DEMO_DELIVERY_ADDRESSES,
  DEMO_DRIVERS,
  canCreateDelivery,
  validateDelivery,
} from "@/lib/delivery-demo";
import { DEMO_CUSTOMERS } from "@/lib/sales-demo";

export function DeliveryForm({ defaultOrderId }: { defaultOrderId?: string }) {
  const { orders, error: ordersError } = useSalesDemo();
  const { deliveries, addDelivery, ready } = useDistributionDemo();
  const eligibleOrders = orders.filter(
    (order) =>
      canCreateDelivery(order) &&
      !deliveries.some((delivery) => delivery.orderId === order.id),
  );
  const initialOrderId = eligibleOrders.some(
    (order) => order.id === defaultOrderId,
  )
    ? defaultOrderId!
    : "";
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId);
  const selectedOrder = orders.find(
    (order) => order.id === selectedOrderId,
  );
  const [address, setAddress] = useState(
    selectedOrder
      ? DEMO_DELIVERY_ADDRESSES[selectedOrder.customerId] ?? ""
      : "",
  );
  const [error, setError] = useState("");
  const [createdDeliveryId, setCreatedDeliveryId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const input = {
      orderId: String(formData.get("orderId") ?? ""),
      address: String(formData.get("address") ?? ""),
      deliveryDate: String(formData.get("deliveryDate") ?? ""),
      driverId: String(formData.get("driverId") ?? ""),
      notes: String(formData.get("notes") ?? "").trim(),
    };
    const validationError = validateDelivery(input, orders, deliveries);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const delivery = addDelivery(input);
      setCreatedDeliveryId(delivery.id);
      setSelectedOrderId("");
      setAddress("");
      event.currentTarget.reset();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "تعذّر إنشاء سجل التوصيل التجريبي.",
      );
    }
  }

  if (eligibleOrders.length === 0 && createdDeliveryId) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200"
        >
          تم إنشاء سجل التوصيل بنجاح.{" "}
          <Link
            href={`/distribution/deliveries/${createdDeliveryId}`}
            className="font-semibold underline underline-offset-2"
          >
            عرض تفاصيل التوصيل
          </Link>
        </p>
        <Button
          variant="outline"
          render={<Link href="/distribution" />}
        >
          العودة إلى لوحة التوزيع
        </Button>
      </div>
    );
  }

  if (eligibleOrders.length === 0) {
    return (
      <div className="space-y-4">
        {ordersError && (
          <p role="alert" className="text-sm text-rose-300">
            {ordersError}
          </p>
        )}
        <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm leading-6 text-sky-200">
          لا توجد طلبات مؤكدة أو جاهزة للتسليم دون سجل توصيل. أكّد طلب عميل أو
          جهّزه للتسليم أولًا.
        </p>
        <Button variant="outline" render={<Link href="/sales/orders" />}>
          فتح طلبات العملاء
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
        سجل توصيل توضيحي مرتبط بطلب قائم. لا توجد خرائط أو تتبع فعلي، ولا يغيّر
        المخزون.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="orderId">طلب العميل *</Label>
          <select
            id="orderId"
            name="orderId"
            required
            value={selectedOrderId}
            onChange={(event) => {
              const nextOrderId = event.target.value;
              setSelectedOrderId(nextOrderId);
              const nextOrder = orders.find(
                (order) => order.id === nextOrderId,
              );
              setAddress(
                nextOrder
                  ? DEMO_DELIVERY_ADDRESSES[nextOrder.customerId] ?? ""
                  : "",
              );
            }}
            className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="" disabled>
              اختر طلبًا مؤكدًا أو جاهزًا
            </option>
            {eligibleOrders.map((order) => {
              const customer = DEMO_CUSTOMERS.find(
                (entry) => entry.id === order.customerId,
              );
              return (
                <option key={order.id} value={order.id}>
                  {order.number} — {customer?.name ?? "عميل"} —{" "}
                  {order.status === "READY" ? "جاهز للتسليم" : "مؤكد"}
                </option>
              );
            })}
          </select>
        </div>

        {selectedOrder && (
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <p className="text-xs text-slate-400">العميل المرتبط بالطلب</p>
            <p className="mt-2 font-medium text-white">
              {DEMO_CUSTOMERS.find(
                (customer) => customer.id === selectedOrder.customerId,
              )?.name ?? "عميل غير معروف"}
            </p>
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
            placeholder="أدخل عنوان التسليم بالتفصيل"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliveryDate">تاريخ التوصيل *</Label>
          <Input
            id="deliveryDate"
            name="deliveryDate"
            type="date"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driverId">السائق المكلّف *</Label>
          <select
            id="driverId"
            name="driverId"
            required
            defaultValue=""
            className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="" disabled>
              اختر سائقًا تجريبيًا
            </option>
            {DEMO_DRIVERS.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} — {driver.phone}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">ملاحظات التوصيل</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            placeholder="أضف ملاحظات للسائق..."
            className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          />
        </div>
      </div>

      {!ready && (
        <p role="status" className="text-sm text-slate-400">
          جارٍ تجهيز بيانات العرض...
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
      {ordersError && (
        <p role="alert" className="text-sm text-rose-300">
          {ordersError}
        </p>
      )}
      {createdDeliveryId && (
        <p
          role="status"
          className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-200"
        >
          تم إنشاء سجل التوصيل بنجاح.{" "}
          <Link
            href={`/distribution/deliveries/${createdDeliveryId}`}
            className="font-semibold underline underline-offset-2"
          >
            عرض تفاصيل التوصيل
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!ready}>
          إنشاء سجل توصيل تجريبي
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/distribution/deliveries" />}
        >
          العودة إلى سجلات التوصيل
        </Button>
      </div>
    </form>
  );
}

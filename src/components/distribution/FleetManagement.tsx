"use client";

import { useState, useTransition } from "react";
import {
  createDeliveryDriver,
  createDeliveryVehicle,
  setDeliveryDriverActive,
  setDeliveryVehicleActive,
} from "@/app/distribution/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DELIVERY_VEHICLE_TYPE_LABELS,
  DELIVERY_VEHICLE_TYPES,
  type DeliveryVehicleType,
} from "@/lib/delivery-state";

type Driver = { id: string; name: string; phone: string; isActive: boolean };
type Vehicle = {
  id: string;
  plate: string;
  label: string;
  type: DeliveryVehicleType;
  maxStops: number;
  isActive: boolean;
};

export function FleetManagement({
  drivers,
  vehicles,
  canManage,
}: {
  drivers: Driver[];
  vehicles: Vehicle[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function submit(action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>) {
    return (formData: FormData) => {
      setError("");
      setMessage("");
      startTransition(async () => {
        try {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error ?? "تعذّر حفظ بيانات الأسطول.");
            return;
          }
          setMessage("تم حفظ البيانات.");
        } catch {
          setError("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
        }
      });
    };
  }

  function toggle(action: (id: string, active: boolean) => Promise<{ ok: boolean; error?: string }>, id: string, active: boolean) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action(id, active);
        if (!result.ok) {
          setError(result.error ?? "تعذّر تحديث الحالة.");
          return;
        }
        setMessage("تم تحديث الحالة.");
      } catch {
        setError("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {(error || message) && (
        <p role={error ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-rose-400/20 bg-rose-400/[0.06] text-rose-200" : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"}`}>
          {error || message}
        </p>
      )}
      {canManage && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form action={submit(createDeliveryDriver)} className="space-y-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
            <h2 className="font-semibold text-white">تسجيل سائق</h2>
            <div className="space-y-2"><Label htmlFor="driver-name">الاسم *</Label><Input id="driver-name" name="name" maxLength={160} required /></div>
            <div className="space-y-2"><Label htmlFor="driver-phone">الهاتف *</Label><Input id="driver-phone" name="phone" maxLength={40} required /></div>
            <Button type="submit" disabled={pending}>إضافة سائق</Button>
          </form>
          <form action={submit(createDeliveryVehicle)} className="space-y-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
            <h2 className="font-semibold text-white">تسجيل مركبة</h2>
            <div className="space-y-2"><Label htmlFor="vehicle-plate">رقم اللوحة *</Label><Input id="vehicle-plate" name="plate" maxLength={40} required dir="ltr" /></div>
            <div className="space-y-2"><Label htmlFor="vehicle-label">وصف المركبة *</Label><Input id="vehicle-label" name="label" maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor="vehicle-type">النوع *</Label><select id="vehicle-type" name="type" className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100">{DELIVERY_VEHICLE_TYPES.map((type) => <option key={type} value={type}>{DELIVERY_VEHICLE_TYPE_LABELS[type]}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="vehicle-maxStops">سعة التوقفات *</Label><Input id="vehicle-maxStops" name="maxStops" type="number" min={1} max={200} step={1} defaultValue={8} required /><p className="text-xs text-slate-500">عدد العناوين في المسار، لا تمثل وزنًا أو حجمًا.</p></div>
            <Button type="submit" disabled={pending}>إضافة مركبة</Button>
          </form>
        </section>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
          <h2 className="border-b border-white/[0.06] px-5 py-4 font-semibold text-white">السائقون</h2>
          {drivers.length === 0 ? <p className="p-5 text-sm text-slate-400">لا يوجد سائقون مسجلون.</p> : (
            <ul className="divide-y divide-white/[0.05]">{drivers.map((driver) => (
              <li key={driver.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div><p className="font-medium text-white">{driver.name}</p><p className="mt-1 text-sm text-slate-400" dir="ltr">{driver.phone}</p></div>
                <div className="flex items-center gap-3"><span className={driver.isActive ? "text-xs text-emerald-300" : "text-xs text-slate-500"}>{driver.isActive ? "نشط" : "غير نشط"}</span>{canManage && <Button size="sm" variant="outline" disabled={pending} onClick={() => toggle(setDeliveryDriverActive, driver.id, !driver.isActive)}>{driver.isActive ? "إيقاف" : "تفعيل"}</Button>}</div>
              </li>
            ))}</ul>
          )}
        </section>
        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
          <h2 className="border-b border-white/[0.06] px-5 py-4 font-semibold text-white">المركبات</h2>
          {vehicles.length === 0 ? <p className="p-5 text-sm text-slate-400">لا توجد مركبات مسجلة.</p> : (
            <ul className="divide-y divide-white/[0.05]">{vehicles.map((vehicle) => (
              <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div><p className="font-medium text-white">{vehicle.label}</p><p className="mt-1 font-mono text-xs text-slate-400" dir="ltr">{vehicle.plate}</p><p className="mt-1 text-xs text-slate-500">{DELIVERY_VEHICLE_TYPE_LABELS[vehicle.type]} · {vehicle.maxStops} توقفات</p></div>
                <div className="flex items-center gap-3"><span className={vehicle.isActive ? "text-xs text-emerald-300" : "text-xs text-slate-500"}>{vehicle.isActive ? "نشطة" : "غير نشطة"}</span>{canManage && <Button size="sm" variant="outline" disabled={pending} onClick={() => toggle(setDeliveryVehicleActive, vehicle.id, !vehicle.isActive)}>{vehicle.isActive ? "إيقاف" : "تفعيل"}</Button>}</div>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeliveryRun } from "@/app/distribution/actions";
import {
  DELIVERY_PRIORITY_LABELS,
  DELIVERY_PRIORITIES,
} from "@/lib/delivery-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FleetOption = { id: string; name: string };
type VehicleOption = { id: string; plate: string; label: string; maxStops: number };

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

export function DeliveryRunCreateForm({
  drivers,
  vehicles,
  defaultRegion,
}: {
  drivers: FleetOption[];
  vehicles: VehicleOption[];
  defaultRegion?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await createDeliveryRun(formData);
        if (!result.ok || !result.id) {
          setError(result.error ?? "تعذّر إنشاء المسار.");
          return;
        }
        router.push(`/distribution/runs/${result.id}`);
        router.refresh();
      } catch {
        setError("تعذّر الاتصال بالخادم. تحقّق من المسار ثم حاول مجددًا.");
      }
    });
  }

  if (drivers.length === 0 || vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
          يلزم تسجيل سائق ومركبة نشطين قبل تخطيط المسار.
        </p>
        <Button type="button" variant="outline" onClick={() => router.push("/distribution/fleet")}>
          إدارة الأسطول
        </Button>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="region">المنطقة / الولاية *</Label>
          <Input id="region" name="region" maxLength={120} defaultValue={defaultRegion} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduledDate">تاريخ المسار *</Label>
          <Input
            id="scheduledDate"
            name="scheduledDate"
            type="date"
            min={localDate(new Date())}
            defaultValue={tomorrowLocalDate()}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">الأولوية *</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="NORMAL"
            className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100"
          >
            {DELIVERY_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {DELIVERY_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="driverId">السائق *</Label>
          <select id="driverId" name="driverId" required defaultValue="" className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100">
            <option value="" disabled>اختر سائقًا</option>
            {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="vehicleId">المركبة *</Label>
          <select id="vehicleId" name="vehicleId" required defaultValue="" className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100">
            <option value="" disabled>اختر مركبة</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.label} — {vehicle.plate} · {vehicle.maxStops} توقفات كحد أقصى
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">السعة هنا عدد التوقفات المخططة، وليست وزنًا أو حجمًا للشحنات.</p>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : "إنشاء مسار مخطط"}</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/distribution/runs")}>إلغاء</Button>
      </div>
    </form>
  );
}

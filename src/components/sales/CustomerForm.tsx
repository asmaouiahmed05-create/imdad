"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer, updateCustomer } from "@/app/sales/actions";

type CustomerValues = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

export function CustomerForm({ customer }: { customer?: CustomerValues }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = customer
        ? await updateCustomer(formData)
        : await createCustomer(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر حفظ بيانات العميل.");
        return;
      }
      router.push("/sales/customers");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">اسم العميل أو المؤسسة *</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={160}
            defaultValue={customer?.name ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPerson">جهة الاتصال</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            maxLength={120}
            defaultValue={customer?.contactPerson ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">الهاتف</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            maxLength={40}
            defaultValue={customer?.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            maxLength={254}
            defaultValue={customer?.email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">المدينة</Label>
          <Input
            id="city"
            name="city"
            maxLength={120}
            defaultValue={customer?.city ?? ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">العنوان</Label>
          <Input
            id="address"
            name="address"
            maxLength={300}
            defaultValue={customer?.address ?? ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">ملاحظات</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            defaultValue={customer?.notes ?? ""}
            className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          />
        </div>
        {customer && (
          <div className="space-y-2">
            <Label htmlFor="isActive">حالة العميل</Label>
            <select
              id="isActive"
              name="isActive"
              defaultValue={String(customer.isActive)}
              className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="true">نشط</option>
              <option value="false">غير نشط</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : customer ? "حفظ التعديلات" : "إضافة العميل"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/sales/customers")}
        >
          إلغاء
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupplier, updateSupplier } from "@/app/purchasing-actions";

export type SupplierFormValue = {
  id?: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

export function SupplierForm({ supplier }: { supplier?: SupplierFormValue }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = supplier
        ? await updateSupplier(formData)
        : await createSupplier(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر حفظ المورد.");
        return;
      }
      router.push(`/suppliers/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplier-name">اسم المورد *</Label>
          <Input
            id="supplier-name"
            name="name"
            required
            maxLength={120}
            defaultValue={supplier?.name ?? ""}
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-contact">الشخص المسؤول</Label>
          <Input
            id="supplier-contact"
            name="contactPerson"
            maxLength={120}
            defaultValue={supplier?.contactPerson ?? ""}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-phone">رقم الهاتف</Label>
          <Input
            id="supplier-phone"
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={supplier?.phone ?? ""}
            autoComplete="tel"
            dir="auto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-email">البريد الإلكتروني</Label>
          <Input
            id="supplier-email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={supplier?.email ?? ""}
            autoComplete="email"
            dir="ltr"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="supplier-address">العنوان</Label>
          <Input
            id="supplier-address"
            name="address"
            maxLength={300}
            defaultValue={supplier?.address ?? ""}
            autoComplete="street-address"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="supplier-notes">ملاحظات</Label>
          <textarea
            id="supplier-notes"
            name="notes"
            maxLength={2000}
            defaultValue={supplier?.notes ?? ""}
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
      <label className="flex w-fit items-center gap-2 text-sm text-slate-300">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={supplier?.isActive ?? true}
          className="size-4 accent-sky-500"
        />
        مورد نشط ويمكن اختياره في أوامر الشراء
      </label>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "جارٍ الحفظ..." : supplier ? "حفظ التعديلات" : "إضافة المورد"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

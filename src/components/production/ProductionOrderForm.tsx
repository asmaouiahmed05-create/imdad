"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const mockProducts = [
  "كرسي مكتبي",
  "طاولة اجتماعات",
  "رف تخزين معدني",
  "خزانة ملفات",
];

export function ProductionOrderForm() {
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startDate = String(formData.get("plannedStartDate") ?? "");
    const completionDate = String(formData.get("expectedCompletionDate") ?? "");

    if (completionDate < startDate) {
      setMessage("يجب أن يكون تاريخ الإنجاز المتوقع بعد تاريخ بدء الإنتاج.");
      return;
    }

    setMessage(
      "هذه واجهة تجريبية فقط. لم يتم حفظ أمر الإنتاج أو إنشاء سجل فعلي.",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
        نموذج تجريبي: المنتجات أمثلة ثابتة، ولن تُحفظ البيانات أو تُغيّر المخزون.
      </p>

      <div className="space-y-2">
        <Label htmlFor="finishedProduct">المنتج النهائي *</Label>
        <select
          id="finishedProduct"
          name="finishedProduct"
          required
          defaultValue=""
          className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
        >
          <option value="" disabled>
            اختر منتجًا نموذجيًا
          </option>
          {mockProducts.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plannedQuantity">الكمية المخططة *</Label>
          <Input
            id="plannedQuantity"
            name="plannedQuantity"
            type="number"
            min="0.000001"
            step="0.000001"
            inputMode="decimal"
            placeholder="مثال: 100"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plannedStartDate">تاريخ بدء الإنتاج *</Label>
          <Input
            id="plannedStartDate"
            name="plannedStartDate"
            type="date"
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="expectedCompletionDate">
            تاريخ الإنجاز المتوقع *
          </Label>
          <Input
            id="expectedCompletionDate"
            name="expectedCompletionDate"
            type="date"
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">ملاحظات</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            placeholder="أضف ملاحظات تخطيطية..."
            className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          />
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={
            message.startsWith("يجب")
              ? "text-sm text-rose-300"
              : "text-sm text-amber-200"
          }
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">معاينة البيانات</Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/production" />}
        >
          العودة إلى الإنتاج
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProductionDemo } from "@/components/production/ProductionDemoProvider";
import {
  DEMO_PRODUCTS,
  parseProductionQuantity,
  validateProductionOrder,
} from "@/lib/production-demo";

export function ProductionOrderForm() {
  const router = useRouter();
  const { addOrder, ready } = useProductionDemo();
  const [error, setError] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const quantity = parseProductionQuantity(
      String(formData.get("plannedQuantity") ?? ""),
    );
    if (quantity === null) {
      setError("أدخل كمية أكبر من صفر وبحد أقصى ست خانات عشرية.");
      return;
    }

    const input = {
      product: String(formData.get("finishedProduct") ?? ""),
      quantity,
      plannedStartDate: String(formData.get("plannedStartDate") ?? ""),
      expectedCompletionDate: String(
        formData.get("expectedCompletionDate") ?? "",
      ),
      notes: String(formData.get("notes") ?? "").trim(),
    };
    const validationError = validateProductionOrder(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const order = addOrder(input);
      setCreatedOrderId(order.id);
      event.currentTarget.reset();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "تعذّر إنشاء أمر العرض. حاول مرة أخرى.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
        نموذج تفاعلي للعرض فقط. يُحفظ الأمر في تخزين هذا المتصفح؛ لا يُحفظ في
        قاعدة بيانات ولا يغيّر المخزون.
      </p>

      {!ready && (
        <p role="status" className="text-sm text-slate-400">
          جارٍ تجهيز بيانات العرض...
        </p>
      )}

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
            اختر منتجًا تجريبيًا
          </option>
          {DEMO_PRODUCTS.map((product) => (
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
            max="1000000000"
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

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
      {createdOrderId && (
        <p
          role="status"
          className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-200"
        >
          تم إنشاء أمر العرض بنجاح.{" "}
          <Link
            href={`/production/orders/${createdOrderId}`}
            className="font-semibold underline underline-offset-2"
          >
            عرض التفاصيل
          </Link>
          {" · "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => router.push("/production")}
          >
            فتح قائمة الإنتاج
          </button>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!ready}>
          إنشاء أمر تجريبي
        </Button>
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

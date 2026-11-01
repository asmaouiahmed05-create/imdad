"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import { DEMO_PRODUCTS } from "@/lib/production-demo";
import {
  DEMO_CUSTOMERS,
  parseSalesQuantity,
  validateSalesOrder,
} from "@/lib/sales-demo";

export function SalesOrderForm({
  defaultCustomerId,
}: {
  defaultCustomerId?: string;
}) {
  const { addOrder, ready } = useSalesDemo();
  const [error, setError] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const quantity = parseSalesQuantity(
      String(formData.get("quantity") ?? ""),
    );
    if (quantity === null) {
      setError("أدخل كمية صحيحة أكبر من صفر وبحد أقصى مليون قطعة.");
      return;
    }

    const input = {
      customerId: String(formData.get("customerId") ?? ""),
      product: String(formData.get("product") ?? ""),
      quantity,
      orderDate: String(formData.get("orderDate") ?? ""),
      expectedDeliveryDate: String(
        formData.get("expectedDeliveryDate") ?? "",
      ),
      notes: String(formData.get("notes") ?? "").trim(),
    };
    const validationError = validateSalesOrder(input);
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
          : "تعذّر إنشاء طلب العرض. حاول مرة أخرى.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
        نموذج تجريبي للعرض فقط. يُحفظ الطلب في هذا المتصفح، ولا ينشئ تسليمًا أو
        عملية دفع ولا يغيّر المخزون.
      </p>

      {!ready && (
        <p role="status" className="text-sm text-slate-400">
          جارٍ تجهيز بيانات العرض...
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="customerId">العميل *</Label>
          <select
            id="customerId"
            name="customerId"
            required
            defaultValue={defaultCustomerId ?? ""}
            className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="" disabled>
              اختر عميلًا
            </option>
            {DEMO_CUSTOMERS.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} — {customer.city}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="product">المنتج *</Label>
          <select
            id="product"
            name="product"
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

        <div className="space-y-2">
          <Label htmlFor="quantity">الكمية *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            max="1000000"
            step="1"
            inputMode="numeric"
            placeholder="مثال: 24"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="orderDate">تاريخ الطلب *</Label>
          <Input id="orderDate" name="orderDate" type="date" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="expectedDeliveryDate">
            تاريخ التسليم المتوقع *
          </Label>
          <Input
            id="expectedDeliveryDate"
            name="expectedDeliveryDate"
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
            placeholder="أضف ملاحظات حول الطلب..."
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
          تم إنشاء طلب العميل بنجاح.{" "}
          <Link
            href={`/sales/orders/${createdOrderId}`}
            className="font-semibold underline underline-offset-2"
          >
            عرض التفاصيل
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!ready}>
          إنشاء طلب تجريبي
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/sales/orders" />}
        >
          العودة إلى الطلبات
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/app/purchasing-actions";

type SupplierOption = { id: string; name: string; isActive: boolean };
type ProductOption = { id: string; name: string; sku: string; unit: string };
type InitialLine = { productId: string; quantity: number };
type DraftLine = { productId: string; quantity: string };

export function PurchaseOrderForm({
  suppliers,
  products,
  orderId,
  initialSupplierId,
  initialLines,
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  orderId?: string;
  initialSupplierId?: string;
  initialLines?: InitialLine[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>(
    initialLines?.length
      ? initialLines.map((line) => ({
          productId: line.productId,
          quantity: String(line.quantity),
        }))
      : [{ productId: "", quantity: "" }],
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateLine(index: number, change: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...change } : line,
      ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = orderId
        ? await updatePurchaseOrder(formData)
        : await createPurchaseOrder(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر حفظ أمر الشراء.");
        return;
      }
      router.push(`/purchase-orders/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {orderId && <input type="hidden" name="id" value={orderId} />}
      <div className="max-w-xl space-y-2">
        <Label htmlFor="supplierId">المورد *</Label>
        <select
          id="supplierId"
          name="supplierId"
          required
          defaultValue={initialSupplierId ?? ""}
          className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
        >
          <option value="" disabled>
            اختر موردًا نشطًا
          </option>
          {suppliers.map((supplier) => (
            <option
              key={supplier.id}
              value={supplier.id}
              disabled={!supplier.isActive && supplier.id !== initialSupplierId}
            >
              {supplier.name}
              {!supplier.isActive ? " (غير نشط)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">أصناف الأمر</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((current) => [...current, { productId: "", quantity: "" }])}
          >
            <Plus aria-hidden="true" />
            إضافة صنف
          </Button>
        </div>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-white/[0.07] bg-slate-950/50 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor={`product-${index}`}>الصنف</Label>
              <select
                id={`product-${index}`}
                name="productId"
                required={index === 0 || Boolean(line.quantity)}
                value={line.productId}
                onChange={(event) => updateLine(index, { productId: event.target.value })}
                className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-900 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
              >
                <option value="">اختر صنفًا</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.sku} ({product.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`quantity-${index}`}>الكمية المطلوبة</Label>
              <Input
                id={`quantity-${index}`}
                name="quantity"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                required={Boolean(line.productId) || index === 0}
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="إزالة الصنف"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
              }
              className="text-rose-300 hover:text-rose-200"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        لا تُسجل أسعار أو إجماليات مالية. يزداد المخزون فقط عند تسجيل الاستلام.
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending || suppliers.length === 0 || products.length === 0}>
          {isPending ? "جارٍ الحفظ..." : orderId ? "حفظ المسودة" : "إنشاء مسودة"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          إلغاء
        </Button>
      </div>
      {suppliers.length === 0 && (
        <p className="text-sm text-amber-300">
          أضف موردًا نشطًا قبل إنشاء أمر شراء.
        </p>
      )}
      {products.length === 0 && (
        <p className="text-sm text-amber-300">
          أضف منتجًا إلى المخزون قبل إنشاء أمر شراء.
        </p>
      )}
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomerOrder,
  updateCustomerOrder,
} from "@/app/sales/actions";
import {
  MAX_CUSTOMER_ORDER_LINES,
} from "@/lib/sales-order-state";
import {
  MAX_INVENTORY_DECIMAL_PLACES,
  MAX_INVENTORY_QUANTITY,
} from "@/lib/inventory-quantity";

type CustomerOption = {
  id: string;
  name: string;
  city: string | null;
  isActive?: boolean;
};
type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  available: number;
};
type InitialLine = { productId: string; quantity: number };
type DraftLine = { productId: string; quantity: string };
type InitialOrder = {
  id: string;
  customerId: string;
  expectedFulfillmentAt: Date | null;
  notes: string | null;
  updatedAt: Date;
  lines: InitialLine[];
};

const quantityStep = 10 ** -MAX_INVENTORY_DECIMAL_PLACES;
const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: MAX_INVENTORY_DECIMAL_PLACES,
});

export function SalesOrderForm({
  customers,
  products,
  order,
  idempotencyKey,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  order?: InitialOrder;
  idempotencyKey?: string;
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>(
    order?.lines.length
      ? order.lines.map((line) => ({
          productId: line.productId,
          quantity: String(line.quantity),
        }))
      : [{ productId: "", quantity: "" }],
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function updateLine(index: number, change: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...change } : line,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = order
        ? await updateCustomerOrder(formData)
        : await createCustomerOrder(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر حفظ مسودة الطلب.");
        return;
      }
      router.push(`/sales/orders/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {order ? (
        <>
          <input type="hidden" name="id" value={order.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={order.updatedAt.toISOString()}
          />
        </>
      ) : (
        <input
          type="hidden"
          name="idempotencyKey"
          value={idempotencyKey ?? ""}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="customerId">العميل *</Label>
          <select
            id="customerId"
            name="customerId"
            required
            defaultValue={order?.customerId ?? defaultCustomerId ?? ""}
            className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
          >
            <option value="" disabled>
              اختر عميلًا نشطًا
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.city ? ` — ${customer.city}` : ""}
                {customer.isActive === false ? " (غير نشط)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="expectedFulfillmentDate">
            تاريخ الإنجاز المتوقع
          </Label>
          <Input
            id="expectedFulfillmentDate"
            name="expectedFulfillmentDate"
            type="date"
            defaultValue={
              order?.expectedFulfillmentAt?.toISOString().slice(0, 10) ?? ""
            }
          />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              أصناف الطلب
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              الكمية المتاحة = الرصيد الفعلي − الكمية المحجوزة.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={lines.length >= MAX_CUSTOMER_ORDER_LINES}
            onClick={() =>
              setLines((current) => [...current, { productId: "", quantity: "" }])
            }
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
              <Label htmlFor={`product-${index}`}>المنتج النهائي *</Label>
              <select
                id={`product-${index}`}
                name="productId"
                required={index === 0 || Boolean(line.quantity)}
                value={line.productId}
                onChange={(event) =>
                  updateLine(index, { productId: event.target.value })
                }
                className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-900 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
              >
                <option value="">اختر منتجًا</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.sku} ({product.unit}) · متاح{" "}
                    {numberFormatter.format(Math.max(product.available, 0))}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`quantity-${index}`}>الكمية *</Label>
              <Input
                id={`quantity-${index}`}
                name="quantity"
                type="number"
                min={quantityStep}
                max={MAX_INVENTORY_QUANTITY}
                step={quantityStep}
                inputMode="decimal"
                required={Boolean(line.productId) || index === 0}
                value={line.quantity}
                onChange={(event) =>
                  updateLine(index, { quantity: event.target.value })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`إزالة الصنف ${index + 1}`}
              disabled={lines.length === 1}
              onClick={() =>
                setLines((current) =>
                  current.filter((_, lineIndex) => lineIndex !== index),
                )
              }
              className="text-rose-300 hover:text-rose-200"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-200">
            لا توجد منتجات مصنفة كمنتج نهائي أو مشترك. أضف منتجًا نهائيًا إلى
            المخزون أولًا.
          </p>
        )}
      </section>

      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={2000}
          defaultValue={order?.notes ?? ""}
          className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
        />
      </div>

      <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm leading-6 text-sky-100">
        حفظ المسودة لا يحجز المخزون. عند التأكيد يُحجز المتاح؛ وعند الإكمال
        يُخصم الرصيد وتُسجل حركة صرف. لا يتضمن الطلب أسعارًا أو دفعًا أو توصيلًا.
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || customers.length === 0 || products.length === 0}>
          {pending ? "جارٍ الحفظ..." : order ? "حفظ المسودة" : "إنشاء مسودة"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/sales/orders")}
        >
          إلغاء
        </Button>
      </div>
      {customers.length === 0 && (
        <p className="text-sm text-amber-300">
          أضف عميلًا نشطًا قبل إنشاء طلب.
        </p>
      )}
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { receivePurchaseOrder } from "@/app/purchasing-actions";
import {
  MAX_INVENTORY_DECIMAL_PLACES,
  MAX_INVENTORY_QUANTITY,
} from "@/lib/inventory-quantity";

export type ReceiptFormLine = {
  id: string;
  productName: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
};

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 4,
});

const quantityStep = 10 ** -MAX_INVENTORY_DECIMAL_PLACES;

export function PurchaseOrderReceiptForm({
  id,
  receiptToken,
  lines,
}: {
  id: string;
  receiptToken: string;
  lines: ReceiptFormLine[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const hasRemainder = lines.some(
    (line) => line.receivedQuantity < line.orderedQuantity,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("id", id);
    startTransition(async () => {
      const result = await receivePurchaseOrder(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر تسجيل الاستلام.");
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="receiptToken" value={receiptToken} />
      {lines.map((line) => {
        const remaining = line.orderedQuantity - line.receivedQuantity;
        return (
          <div
            key={line.id}
            className="grid gap-3 border-b border-white/[0.06] py-3 sm:grid-cols-[minmax(0,1fr)_12rem]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">
                {line.productName}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                مستلم {numberFormatter.format(line.receivedQuantity)} من{" "}
                {numberFormatter.format(line.orderedQuantity)} {line.unit}
              </p>
            </div>
            {remaining > 0 ? (
              <label className="grid gap-1 text-xs text-slate-400">
                الكمية المستلمة الآن (المتبقي {numberFormatter.format(remaining)})
                <Input
                  name={`receipt-${line.id}`}
                  type="number"
                  min={quantityStep}
                  max={Math.min(remaining, MAX_INVENTORY_QUANTITY)}
                  step={quantityStep}
                  inputMode="decimal"
                  aria-label={`كمية الاستلام للصنف ${line.productName}`}
                  disabled={isPending}
                />
              </label>
            ) : (
              <span className="self-center text-xs text-emerald-300">
                اكتمل استلام الصنف
              </span>
            )}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending || !hasRemainder}>
        {isPending ? "جارٍ تسجيل الاستلام..." : "تسجيل الاستلام"}
      </Button>
      <p className="text-xs leading-5 text-slate-500">
        سيُسجّل كل استلام كحركة إدخال مرتبطة بهذا الأمر، وتُحدّث الكمية في معاملة واحدة.
      </p>
    </form>
  );
}

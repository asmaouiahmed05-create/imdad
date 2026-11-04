"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProductionOrder,
  updateProductionOrder,
} from "@/app/production/orders/actions";
import { calculateMaterialRequirements } from "@/lib/production-orders";

type BomOption = {
  id: string;
  revision: number;
  finishedProductName: string;
  finishedProductSku: string;
  finishedProductUnit: string;
  finishedProductId: string;
  components: {
    materialProductId: string;
    materialName: string;
    materialSku: string;
    unit: string;
    quantityPerUnit: string;
    availableQuantity: number;
  }[];
};

const quantityFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 6,
});

export function ProductionOrderForm({
  boms,
  selectedBomId,
  initialOrder,
}: {
  boms: BomOption[];
  selectedBomId?: string;
  initialOrder?: {
    id: string;
    bomId: string;
    plannedQuantity: string;
    plannedStartDate: string;
    expectedCompletionDate: string;
    notes: string;
  };
}) {
  const router = useRouter();
  const [bomId, setBomId] = useState(
    initialOrder?.bomId ?? selectedBomId ?? boms[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(
    initialOrder?.plannedQuantity ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedBom = boms.find((bom) => bom.id === bomId);
  const requirements = useMemo(
    () =>
      selectedBom
        ? calculateMaterialRequirements(
            selectedBom.components,
            quantity,
            selectedBom.finishedProductId,
          )
        : null,
    [selectedBom, quantity],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData(event.currentTarget);
      const result = initialOrder
        ? await updateProductionOrder(formData)
        : await createProductionOrder(formData);
      if (!result.ok || !result.id) {
        setError(result.error ?? "تعذّر إنشاء أمر الإنتاج");
        return;
      }
      router.push(`/production/orders/${result.id}`);
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {initialOrder && (
        <input type="hidden" name="orderId" value={initialOrder.id} />
      )}
      {boms.length === 0 ? (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200">
          لا توجد مراجعة قائمة مواد معتمدة. أنشئ قائمة مواد واعتمدها أولًا.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="bomId">قائمة المواد المعتمدة *</Label>
            <select
              id="bomId"
              name="bomId"
              value={bomId}
              onChange={(event) => setBomId(event.target.value)}
              required
              className="h-10 w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100"
            >
              {boms.map((bom) => (
                <option key={bom.id} value={bom.id}>
                  {bom.finishedProductName} — {bom.finishedProductSku} · مراجعة{" "}
                  {bom.revision}
                </option>
              ))}
            </select>
            {selectedBom && (
              <p className="text-xs text-slate-400">
                الوحدة الناتجة: {selectedBom.finishedProductUnit}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="plannedQuantity">الكمية المخططة *</Label>
            <Input
              id="plannedQuantity"
              name="plannedQuantity"
              type="number"
              min="0.000001"
              max="1000000000"
              step="0.000001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              required
            />
          </div>

          {selectedBom && requirements?.ok && (
            <section className="space-y-3 rounded-xl border border-white/[0.07] bg-slate-950/60 p-4">
              <div>
                <h2 className="font-medium text-white">احتياجات المواد</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  معاينة محسوبة من المراجعة المختارة؛ يعيد الخادم التحقق من
                  الكميات المتاحة عند بدء الإنتاج.
                </p>
              </div>
              <ul className="space-y-2">
                {requirements.requirements.map((requirement) => {
                  const component = selectedBom.components.find(
                    (item) =>
                      item.materialProductId ===
                      requirement.materialProductId,
                  );
                  const available = component?.availableQuantity ?? 0;
                  const sufficient = available >= requirement.requiredQuantity;
                  return (
                    <li
                      key={requirement.materialProductId}
                      className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-sm"
                    >
                      <span className="text-slate-200">
                        {requirement.materialName}
                        <span className="ms-2 font-mono text-xs text-slate-500">
                          {requirement.materialSku}
                        </span>
                      </span>
                      <span
                        className={
                          sufficient ? "text-emerald-300" : "text-rose-300"
                        }
                      >
                        مطلوب{" "}
                        {quantityFormatter.format(
                          requirement.requiredQuantity,
                        )}{" "}
                        {requirement.unit} · متوفر{" "}
                        {quantityFormatter.format(available)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {quantity && requirements && !requirements.ok && (
            <p role="alert" className="text-sm text-rose-300">
              {requirements.error}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plannedStartDate">تاريخ بدء الإنتاج</Label>
              <Input
                id="plannedStartDate"
                name="plannedStartDate"
                type="date"
                defaultValue={initialOrder?.plannedStartDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedCompletionDate">
                الإنجاز المتوقع
              </Label>
              <Input
                id="expectedCompletionDate"
                name="expectedCompletionDate"
                type="date"
                defaultValue={initialOrder?.expectedCompletionDate}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={2000}
                defaultValue={initialOrder?.notes}
                className="w-full rounded-lg border border-white/[0.12] bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>
        </>
      )}

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={submitting || boms.length === 0 || !requirements?.ok}
        >
          {submitting
            ? initialOrder
              ? "جارٍ الحفظ..."
              : "جارٍ الإنشاء..."
            : initialOrder
              ? "حفظ تعديلات المسودة"
              : "إنشاء كمسودة"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/production" />}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

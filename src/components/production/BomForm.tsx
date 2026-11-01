"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBom, updateBom } from "@/app/production/boms/actions";
import type { ProductClassificationValue } from "@/lib/production-bom";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  classification: ProductClassificationValue;
};

type InitialBom = {
  id: string;
  revision: number;
  finishedProductId: string;
  components: {
    materialProductId: string;
    quantityPerUnit: string;
  }[];
};

type BomFormProps = {
  finishedProducts: ProductOption[];
  materials: ProductOption[];
  initialBom?: InitialBom;
  sourceId?: string;
};

type ComponentRow = {
  materialProductId: string;
  quantityPerUnit: string;
};

export function BomForm({
  finishedProducts,
  materials,
  initialBom,
  sourceId,
}: BomFormProps) {
  const router = useRouter();
  const [finishedProductId, setFinishedProductId] = useState(
    initialBom?.finishedProductId ?? finishedProducts[0]?.id ?? "",
  );
  const [components, setComponents] = useState<ComponentRow[]>(
    initialBom?.components.length
      ? initialBom.components
      : [{ materialProductId: materials[0]?.id ?? "", quantityPerUnit: "" }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditingDraft = Boolean(initialBom && !sourceId);

  const selectedProduct = finishedProducts.find(
    (product) => product.id === finishedProductId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const result = isEditingDraft
        ? await updateBom(formData)
        : await createBom(formData);
      if (!result.ok || !result.id) {
        setError(result.error ?? "تعذّر حفظ قائمة المواد");
        return;
      }
      router.push(`/production/boms/${result.id}`);
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  function updateComponent(
    index: number,
    patch: Partial<ComponentRow>,
  ) {
    setComponents((current) =>
      current.map((component, rowIndex) =>
        rowIndex === index ? { ...component, ...patch } : component,
      ),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isEditingDraft && initialBom && (
        <input type="hidden" name="bomId" value={initialBom.id} />
      )}
      {sourceId && <input type="hidden" name="sourceId" value={sourceId} />}
      <div className="space-y-2">
        <Label htmlFor="finishedProductId">المنتج النهائي *</Label>
        {initialBom || sourceId ? (
          <>
            <input
              type="hidden"
              name="finishedProductId"
              value={finishedProductId}
            />
            <div className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              {selectedProduct?.name ?? "المنتج النهائي"}
              {selectedProduct && (
                <span className="ms-2 font-mono text-xs text-slate-500">
                  {selectedProduct.sku}
                </span>
              )}
            </div>
          </>
        ) : (
          <select
            id="finishedProductId"
            name="finishedProductId"
            value={finishedProductId}
            onChange={(event) => setFinishedProductId(event.target.value)}
            required
            className="h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-slate-100"
          >
            {finishedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — {product.sku}
              </option>
            ))}
          </select>
        )}
        {finishedProducts.length === 0 && !initialBom && !sourceId && (
          <p className="text-sm text-amber-300">
            لا يوجد منتج مصنف كمنتج نهائي. صنّف المنتج أولًا من صفحة المخزون.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium text-white">المواد الأولية</h3>
            <p className="mt-1 text-xs text-slate-400">
              الكمية المطلوبة لإنتاج وحدة واحدة من المنتج النهائي.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={materials.length === 0 || components.length >= 100}
            onClick={() =>
              setComponents((current) => [
                ...current,
                {
                  materialProductId: materials[0]?.id ?? "",
                  quantityPerUnit: "",
                },
              ])
            }
          >
            <Plus aria-hidden="true" className="size-4" />
            إضافة مادة
          </Button>
        </div>

        {materials.length === 0 ? (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm text-amber-200">
            لا توجد مواد مصنفة كمادة أولية. صنّف المنتجات في صفحة المخزون أولًا.
          </p>
        ) : (
          <div className="space-y-3">
            {components.map((component, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-white/[0.08] bg-slate-950/60 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor={`material-${index}`}>المادة الأولية *</Label>
                  <select
                    id={`material-${index}`}
                    name="materialProductId"
                    value={component.materialProductId}
                    onChange={(event) =>
                      updateComponent(index, {
                        materialProductId: event.target.value,
                      })
                    }
                    required
                    className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-slate-100"
                  >
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name} — {material.sku}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${index}`}>الكمية لكل وحدة *</Label>
                  <Input
                    id={`quantity-${index}`}
                    name="quantityPerUnit"
                    type="number"
                    min="0.000001"
                    max="1000000000"
                    step="0.000001"
                    value={component.quantityPerUnit}
                    onChange={(event) =>
                      updateComponent(index, {
                        quantityPerUnit: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="حذف المادة"
                  disabled={components.length === 1}
                  onClick={() =>
                    setComponents((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={
            submitting ||
            finishedProducts.length === 0 ||
            materials.length === 0
          }
        >
          {submitting ? "جارٍ الحفظ..." : "حفظ كمسودة"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              isEditingDraft && initialBom
                ? `/production/boms/${initialBom.id}`
                : "/production/boms",
            )
          }
        >
          إلغاء
        </Button>
      </div>
    </form>
  );
}

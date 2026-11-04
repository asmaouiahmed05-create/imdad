"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelProductionOrder,
  completeProductionOrder,
  startProductionOrder,
} from "@/app/production/orders/actions";
import {
  calculateMaterialRequirements,
  PRODUCTION_ORDER_STATUS_CLASSES,
  PRODUCTION_ORDER_STATUS_LABELS,
  type ProductionOrderStatusValue,
} from "@/lib/production-orders";

type ProductionOrderView = {
  id: string;
  orderNumber: string;
  status: ProductionOrderStatusValue;
  plannedQuantity: string;
  producedQuantity: string | null;
  plannedStartDate: string | null;
  expectedCompletionDate: string | null;
  notes: string | null;
  createdAt: string;
  bom: {
    revision: number;
    status: "DRAFT" | "RELEASED" | "RETIRED";
    finishedProductId: string;
    finishedProductName: string;
    finishedProductSku: string;
    finishedProductUnit: string;
    components: {
      materialProductId: string;
      materialName: string;
      materialSku: string;
      unit: string;
      quantityPerUnit: string;
      availableQuantity: number;
    }[];
  };
  movements: {
    type: "IN" | "OUT";
    quantity: number;
    reason: string | null;
    createdAt: string;
    productName: string;
    productSku: string;
    unit: string;
  }[];
};

type DialogAction = "start" | "complete" | "cancel" | null;

const quantityFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 6,
});
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export function ProductionOrderDetail({
  order,
  canManage,
}: {
  order: ProductionOrderView;
  canManage: boolean;
}) {
  const router = useRouter();
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [producedQuantity, setProducedQuantity] = useState(order.plannedQuantity);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const requirements = calculateMaterialRequirements(
    order.bom.components,
    order.plannedQuantity,
    order.bom.finishedProductId,
  );

  function confirmAction() {
    if (!dialogAction) return;
    const action = dialogAction;
    setError("");
    startTransition(async () => {
      try {
        const result =
          action === "start"
            ? await startProductionOrder(order.id)
            : action === "complete"
              ? await completeProductionOrder(order.id, producedQuantity)
              : await cancelProductionOrder(order.id);
        if (!result.ok) {
          setError(result.error ?? "تعذّر تنفيذ الإجراء");
          return;
        }
        setDialogAction(null);
        router.refresh();
      } catch {
        setError("تعذّر تنفيذ الإجراء، تحقق من صلاحيتك وحاول مجددًا");
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/production"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        قائمة الإنتاج
      </Link>

      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
              أمر إنتاج محفوظ
            </p>
            <h1 className="font-mono text-xl font-semibold text-white" dir="ltr">
              {order.orderNumber}
            </h1>
          </div>
          <Badge
            variant="outline"
            className={PRODUCTION_ORDER_STATUS_CLASSES[order.status]}
          >
            {PRODUCTION_ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">المنتج النهائي</dt>
            <dd className="mt-2 font-medium text-white">
              {order.bom.finishedProductName}
              <span className="ms-2 font-mono text-xs text-slate-500">
                {order.bom.finishedProductSku}
              </span>
            </dd>
            <dd className="mt-1 text-xs text-slate-400">
              مراجعة قائمة المواد {order.bom.revision} · لكل{" "}
              {order.bom.finishedProductUnit} واحد
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">الكمية المخططة</dt>
            <dd className="mt-2 font-medium text-white">
              {quantityFormatter.format(Number(order.plannedQuantity))}{" "}
              {order.bom.finishedProductUnit}
            </dd>
            {order.producedQuantity && (
              <dd className="mt-1 text-xs text-emerald-300">
                الكمية المنتجة فعليًا:{" "}
                {quantityFormatter.format(Number(order.producedQuantity))}
              </dd>
            )}
          </div>
          {order.plannedStartDate && (
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <dt className="text-xs text-slate-400">تاريخ البدء المخطط</dt>
              <dd className="mt-2 font-medium text-white">
                {dateFormatter.format(new Date(order.plannedStartDate))}
              </dd>
            </div>
          )}
          {order.expectedCompletionDate && (
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <dt className="text-xs text-slate-400">الإنجاز المتوقع</dt>
              <dd className="mt-2 font-medium text-white">
                {dateFormatter.format(new Date(order.expectedCompletionDate))}
              </dd>
            </div>
          )}
          {order.notes && (
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
              <dt className="text-xs text-slate-400">ملاحظات</dt>
              <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                {order.notes}
              </dd>
            </div>
          )}
        </dl>

        <section className="mt-6 rounded-xl border border-white/[0.07] bg-slate-950/50 p-4">
          <h2 className="font-medium text-white">احتياجات المواد</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            تُحسب من المراجعة المرتبطة بالأمر. التحقق النهائي من الرصيد يتم داخل
            معاملة الإكمال.
          </p>
          {requirements.ok ? (
            <ul className="mt-3 space-y-2">
              {requirements.requirements.map((requirement) => {
                const component = order.bom.components.find(
                  (item) =>
                    item.materialProductId === requirement.materialProductId,
                );
                const available = component?.availableQuantity ?? 0;
                return (
                  <li
                    key={requirement.materialProductId}
                    className="flex flex-wrap justify-between gap-2 border-t border-white/[0.06] pt-2 text-sm"
                  >
                    <span className="text-slate-200">
                      {requirement.materialName}
                      <span className="ms-2 font-mono text-xs text-slate-500">
                        {requirement.materialSku}
                      </span>
                    </span>
                    <span
                      className={
                        available >= requirement.requiredQuantity
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      مطلوب{" "}
                      {quantityFormatter.format(requirement.requiredQuantity)}{" "}
                      {requirement.unit} · متوفر{" "}
                      {quantityFormatter.format(available)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              {requirements.error}
            </p>
          )}
        </section>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {error}
          </p>
        )}
        {canManage && order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
          <div className="mt-6 flex flex-wrap gap-2">
            {order.status === "DRAFT" && (
              <>
                <Button
                  variant="outline"
                  render={<Link href={`/production/orders/${order.id}/edit`} />}
                >
                  تعديل المسودة
                </Button>
                <Button onClick={() => setDialogAction("start")}>
                  <Play aria-hidden="true" />
                  بدء الإنتاج
                </Button>
              </>
            )}
            {order.status === "IN_PROGRESS" && (
              <Button onClick={() => setDialogAction("complete")}>
                <Check aria-hidden="true" />
                إكمال الإنتاج
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setDialogAction("cancel")}
            >
              <X aria-hidden="true" />
              إلغاء الأمر
            </Button>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-semibold text-white">حركات أمر الإنتاج</h2>
          <p className="mt-1 text-xs text-slate-400">
            لا تُسجل حركات المخزون إلا عند إكمال الأمر بنجاح.
          </p>
        </div>
        {order.movements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            لم تُسجل حركات إنتاج لهذا الأمر بعد.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {order.movements.map((movement, index) => (
              <li
                key={`${movement.type}-${movement.productSku}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {movement.productName}
                    <span className="ms-2 font-mono text-xs text-slate-500">
                      {movement.productSku}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {movement.reason ?? "حركة إنتاج"} ·{" "}
                    {dateFormatter.format(new Date(movement.createdAt))}
                  </p>
                </div>
                <p
                  className={
                    movement.type === "IN"
                      ? "text-sm text-emerald-300"
                      : "text-sm text-amber-300"
                  }
                >
                  {movement.type === "IN" ? "إنتاج" : "استهلاك"}{" "}
                  {quantityFormatter.format(movement.quantity)} {movement.unit}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={dialogAction !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDialogAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "start"
                ? "تأكيد بدء الإنتاج"
                : dialogAction === "complete"
                  ? "تأكيد إكمال الإنتاج"
                  : "تأكيد إلغاء أمر الإنتاج"}
            </DialogTitle>
          </DialogHeader>
          {dialogAction === "start" && (
            <p className="leading-6 text-slate-300">
              سيُعاد التحقق من رصيد جميع المواد المطلوبة قبل بدء الأمر.
            </p>
          )}
          {dialogAction === "complete" && (
            <div className="space-y-2">
              <p className="text-sm leading-6 text-slate-300">
                سيخصم الخادم المواد المطلوبة ويضيف المنتج النهائي في معاملة
                واحدة. الحد الأقصى هو الكمية المخططة (
                {quantityFormatter.format(Number(order.plannedQuantity))}).
              </p>
              <Label htmlFor="producedQuantity">الكمية المنتجة فعليًا</Label>
              <Input
                id="producedQuantity"
                type="number"
                min="0.000001"
                max={order.plannedQuantity}
                step="0.000001"
                value={producedQuantity}
                onChange={(event) => setProducedQuantity(event.target.value)}
                required
              />
            </div>
          )}
          {dialogAction === "cancel" && (
            <p className="leading-6 text-slate-300">
              يمكن إلغاء المسودة أو الأمر قيد التنفيذ. لم تُجرَ أي حركات مخزون
              قبل الإكمال.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialogAction(null)}
            >
              رجوع
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={confirmAction}
            >
              {pending ? "جارٍ التنفيذ..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

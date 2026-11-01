"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelPurchaseOrder,
  submitPurchaseOrder,
} from "@/app/purchasing-actions";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";

export function PurchaseOrderTransitions({
  id,
  status,
  canSubmit,
  canCancel,
}: {
  id: string;
  status: PurchaseOrderStatus;
  canSubmit: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  function runSubmit() {
    setError("");
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      const result = await submitPurchaseOrder(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر إرسال أمر الشراء.");
        return;
      }
      router.refresh();
    });
  }

  function confirmCancellation() {
    setError("");
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      const result = await cancelPurchaseOrder(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر إلغاء أمر الشراء.");
        return;
      }
      setCancelDialogOpen(false);
      router.refresh();
    });
  }

  const cancelLabel = status === "DRAFT" ? "إلغاء المسودة" : "إلغاء الأمر";
  const canCancelInCurrentStatus =
    canCancel && (status === "DRAFT" || status === "SUBMITTED");

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {status === "DRAFT" && canSubmit && (
        <Button type="button" disabled={isPending} onClick={runSubmit}>
          {isPending ? "جارٍ الإرسال..." : "إرسال للمورد"}
        </Button>
      )}
      {canCancelInCurrentStatus && (
        <Dialog
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            if (!isPending) {
              setCancelDialogOpen(open);
              if (open) setError("");
            }
          }}
        >
          <DialogTrigger
            render={
              <Button type="button" variant="outline" disabled={isPending}>
                {cancelLabel}
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تأكيد إلغاء أمر الشراء</DialogTitle>
              <DialogDescription>
                إلغاء الأمر نهائي ولا يمكن التراجع عنه من الواجهة الحالية. لا
                يمكن إلغاء الأمر بعد بدء استلام أي كمية.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
            )}
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={isPending}>
                    عودة
                  </Button>
                }
              />
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={confirmCancellation}
              >
                {isPending ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {error && !cancelDialogOpen && (
        <p role="alert" className="w-full text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

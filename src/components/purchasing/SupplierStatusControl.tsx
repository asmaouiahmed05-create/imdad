"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeSupplierStatus } from "@/app/purchasing-actions";
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

export function SupplierStatusControl({
  supplierId,
  supplierName,
  isActive,
  purchaseOrderCount,
}: {
  supplierId: string;
  supplierName: string;
  isActive: boolean;
  purchaseOrderCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const nextStatus = isActive ? "inactive" : "active";
  const actionLabel = isActive ? "تعطيل المورد" : "تفعيل المورد";

  function confirmStatusChange() {
    setError("");
    const formData = new FormData();
    formData.set("id", supplierId);
    formData.set("status", nextStatus);
    startTransition(async () => {
      const result = await changeSupplierStatus(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر تحديث حالة المورد.");
        return;
      }
      setMessage(isActive ? "تم تعطيل المورد." : "تم تفعيل المورد.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setError("");
        }}
      >
        <DialogTrigger
          render={
            <Button
              type="button"
              variant={isActive ? "outline" : "secondary"}
              size="sm"
            >
              {actionLabel}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabel}</DialogTitle>
            <DialogDescription>
              {isActive
                ? `سيُمنع اختيار ${supplierName} في أوامر الشراء الجديدة. لن تُحذف أوامر الشراء المرتبطة به (${purchaseOrderCount}).`
                : `سيصبح ${supplierName} متاحًا للاختيار في أوامر الشراء الجديدة.`}
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
                <Button type="button" variant="outline" disabled={isPending} />
              }
            >
              إلغاء
            </DialogClose>
            <Button
              type="button"
              variant={isActive ? "destructive" : "default"}
              disabled={isPending}
              onClick={confirmStatusChange}
            >
              {isPending ? "جارٍ التحديث..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {message && (
        <p role="status" className="text-xs text-emerald-300">
          {message}
        </p>
      )}
    </div>
  );
}

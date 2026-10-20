"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  cancelPurchaseOrder,
  submitPurchaseOrder,
} from "@/app/purchasing-actions";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";

export function PurchaseOrderTransitions({
  id,
  status,
}: {
  id: string;
  status: PurchaseOrderStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(action: typeof submitPurchaseOrder) {
    setError("");
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error ?? "تعذّر تحديث حالة أمر الشراء.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <>
          <Button type="button" disabled={isPending} onClick={() => run(submitPurchaseOrder)}>
            {isPending ? "جارٍ الإرسال..." : "إرسال للمورد"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => run(cancelPurchaseOrder)}
          >
            إلغاء المسودة
          </Button>
        </>
      )}
      {status === "SUBMITTED" && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => run(cancelPurchaseOrder)}
        >
          إلغاء الأمر
        </Button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

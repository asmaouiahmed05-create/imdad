"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  cancelCustomerOrder,
  confirmCustomerOrder,
  fulfillCustomerOrder,
} from "@/app/sales/actions";
import type { CustomerOrderStatus } from "@/lib/sales-order-state";

export function CustomerOrderLifecycleActions({
  orderId,
  status,
  canManage,
}: {
  orderId: string;
  status: CustomerOrderStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action(orderId);
        if (!result.ok) {
          setError(result.error ?? "تعذّر تحديث حالة الطلب.");
          return;
        }
        router.refresh();
      } catch {
        setError("تعذّر الاتصال بالخادم. تحقّق من حالة الطلب ثم حاول مجددًا.");
      }
    });
  }

  if (!canManage) return null;

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(confirmCustomerOrder)}
          >
            تأكيد وحجز المخزون
          </Button>
        )}
        {status === "CONFIRMED" && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(fulfillCustomerOrder)}
          >
            إكمال الطلب وخصم المخزون
          </Button>
        )}
        {(status === "DRAFT" || status === "CONFIRMED") && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(cancelCustomerOrder)}
          >
            إلغاء الطلب{status === "CONFIRMED" ? " وتحرير الحجز" : ""}
          </Button>
        )}
        {status === "FULFILLED" && (
          <p className="text-sm text-slate-400">
            لا يمكن إلغاء الطلب المكتمل؛ لا تتوفر معالجة مرتجعات في هذا المسار.
          </p>
        )}
      </div>
    </div>
  );
}

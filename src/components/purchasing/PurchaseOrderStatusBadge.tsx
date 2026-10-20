import { Badge } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";

const statusDetails: Record<
  PurchaseOrderStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "مسودة",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  },
  SUBMITTED: {
    label: "مرسل للمورد",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  PARTIALLY_RECEIVED: {
    label: "استلام جزئي",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  RECEIVED: {
    label: "مستلم بالكامل",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  CANCELLED: {
    label: "ملغى",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
};

export function PurchaseOrderStatusBadge({
  status,
}: {
  status: PurchaseOrderStatus;
}) {
  const details = statusDetails[status];
  return (
    <Badge variant="outline" className={`rounded-full ${details.className}`}>
      {details.label}
    </Badge>
  );
}

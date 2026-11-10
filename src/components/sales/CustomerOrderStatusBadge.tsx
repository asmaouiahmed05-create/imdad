import { Badge } from "@/components/ui/badge";
import {
  CUSTOMER_ORDER_STATUS_CLASSES,
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrderStatus,
} from "@/lib/sales-order-state";

export function CustomerOrderStatusBadge({
  status,
}: {
  status: CustomerOrderStatus;
}) {
  return (
    <Badge
      variant="outline"
      className={`rounded-full ${CUSTOMER_ORDER_STATUS_CLASSES[status]}`}
    >
      {CUSTOMER_ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

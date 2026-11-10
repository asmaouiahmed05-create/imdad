import Link from "next/link";
import { ArrowRight, Pencil } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CustomerOrderLifecycleActions } from "@/components/sales/CustomerOrderLifecycleActions";
import { CustomerOrderStatusBadge } from "@/components/sales/CustomerOrderStatusBadge";

type CustomerOrderDetails = Prisma.CustomerOrderGetPayload<{
  include: {
    customer: true;
    createdBy: { select: { name: true } };
    lines: { include: { reservations: true } };
    movements: {
      include: { product: { select: { name: true, sku: true } } };
      orderBy: { createdAt: "asc" };
    };
  };
}>;

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 6,
});
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "long",
  timeZone: "Africa/Algiers",
});
const dateTimeFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});

export function SalesOrderDetail({
  order,
  canManage,
}: {
  order: CustomerOrderDetails;
  canManage: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/sales/orders"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        طلبات العملاء
      </Link>

      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
              تفاصيل طلب العميل
            </p>
            <h1 className="font-mono text-xl font-semibold text-white" dir="ltr">
              {order.orderNumber}
            </h1>
          </div>
          <CustomerOrderStatusBadge status={order.status} />
        </div>

        <p className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm leading-6 text-sky-100">
          يُحجز المخزون عند التأكيد، ويُخصم عند إكمال الطلب. لا يسجل هذا المسار
          التوصيل أو الدفع أو الفواتير.
        </p>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">العميل</dt>
            <dd className="mt-2 font-medium text-white">{order.customerName}</dd>
            <dd className="mt-1 text-sm text-slate-400">
              {[order.customer.city, order.customer.phone]
                .filter(Boolean)
                .join(" · ") || "لا توجد بيانات اتصال إضافية"}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">تاريخ إنشاء الطلب</dt>
            <dd className="mt-2 font-medium text-white">
              {dateTimeFormatter.format(order.createdAt)}
            </dd>
            <dd className="mt-1 text-sm text-slate-400">
              أنشأه {order.createdBy.name}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <dt className="text-xs text-slate-400">الأصناف والكميات</dt>
            <dd className="mt-3">
              <ul className="divide-y divide-white/[0.05]">
                {order.lines.map((line) => {
                  const activeReservation = line.reservations.find(
                    (reservation) => reservation.releasedAt === null,
                  );
                  return (
                    <li
                      key={line.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-white">{line.productName}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500" dir="ltr">
                          {line.productSku}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-sm text-slate-200">
                          {numberFormatter.format(line.orderedQuantity)} {line.unit}
                        </p>
                        {activeReservation && (
                          <p className="mt-1 text-xs text-sky-300">
                            محجوز: {numberFormatter.format(activeReservation.quantity)}{" "}
                            {line.unit}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">الإنجاز المتوقع</dt>
            <dd className="mt-2 font-medium text-white">
              {order.expectedFulfillmentAt
                ? dateFormatter.format(order.expectedFulfillmentAt)
                : "غير محدد"}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
            <dt className="text-xs text-slate-400">آخر تحديث للحالة</dt>
            <dd className="mt-2 font-medium text-white">
              {order.status === "DRAFT" && "لم يتم التأكيد"}
              {order.status === "CONFIRMED" &&
                `تم التأكيد ${order.confirmedAt ? dateTimeFormatter.format(order.confirmedAt) : ""}`}
              {order.status === "FULFILLED" &&
                `تم الإكمال ${order.fulfilledAt ? dateTimeFormatter.format(order.fulfilledAt) : ""}`}
              {order.status === "CANCELLED" &&
                `تم الإلغاء ${order.cancelledAt ? dateTimeFormatter.format(order.cancelledAt) : ""}`}
            </dd>
            {order.status === "CANCELLED" && order.confirmedAt && (
              <dd className="mt-1 text-xs text-slate-400">
                حُرر الحجز بعد التأكيد.
              </dd>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 sm:col-span-2">
            <dt className="text-xs text-slate-400">ملاحظات</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {order.notes || "لا توجد ملاحظات."}
            </dd>
          </div>
        </dl>

        {order.movements.length > 0 && (
          <section className="mt-5 rounded-xl border border-white/[0.07] bg-slate-950/60 p-4">
            <h2 className="font-semibold text-white">حركات المخزون المسجلة</h2>
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {order.movements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-slate-300">
                    {movement.product.name} ({movement.product.sku})
                  </span>
                  <span className="text-rose-300">
                    صرف {numberFormatter.format(movement.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {canManage && order.status === "DRAFT" && (
              <Button
                variant="outline"
                render={<Link href={`/sales/orders/${order.id}/edit`} />}
              >
                <Pencil aria-hidden="true" />
                تعديل المسودة
              </Button>
            )}
            <CustomerOrderLifecycleActions
              orderId={order.id}
              status={order.status}
              canManage={canManage}
            />
          </div>
          <Button
            variant="outline"
            render={<Link href="/sales/orders" />}
          >
            العودة إلى الطلبات
          </Button>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  PackageCheck,
  Plus,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { CustomerOrderStatusBadge } from "@/components/sales/CustomerOrderStatusBadge";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  CUSTOMER_ORDER_STATUSES,
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrderStatus,
} from "@/lib/sales-order-state";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default async function SalesPage() {
  const principal = await requirePagePermission("sales.read");
  await connection();
  const [groupedOrders, recentOrders, customerCount] = await Promise.all([
    prisma.customerOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.customerOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        expectedFulfillmentAt: true,
        lines: {
          select: { productName: true, orderedQuantity: true, unit: true },
          orderBy: { id: "asc" },
          take: 2,
        },
        _count: { select: { lines: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
    prisma.customer.count(),
  ]);
  const counts = Object.fromEntries(
    CUSTOMER_ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<CustomerOrderStatus, number>;
  for (const entry of groupedOrders) counts[entry.status] = entry._count._all;
  const totalOrders = Object.values(counts).reduce(
    (total, count) => total + count,
    0,
  );
  const canManageOrders = hasPermission(principal.role, "sales.order.manage");
  const canManageCustomers = hasPermission(
    principal.role,
    "sales.customer.manage",
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            المبيعات والعملاء
          </p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            طلبات العملاء
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            إدارة سجلات العملاء وطلبات المنتجات النهائية وحجوزات المخزون.
          </p>
        </div>
        {canManageOrders && (
          <Button render={<Link href="/sales/orders/new" />}>
            <Plus aria-hidden="true" />
            إنشاء طلب عميل
          </Button>
        )}
      </header>

      <section
        aria-label="ملخص طلبات العملاء"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="إجمالي الطلبات"
          value={numberFormatter.format(totalOrders)}
          icon={ClipboardList}
          accent="blue"
        />
        <StatCard
          label={CUSTOMER_ORDER_STATUS_LABELS.DRAFT}
          value={numberFormatter.format(counts.DRAFT)}
          icon={Clock3}
          accent="violet"
        />
        <StatCard
          label={CUSTOMER_ORDER_STATUS_LABELS.CONFIRMED}
          value={numberFormatter.format(counts.CONFIRMED)}
          icon={PackageCheck}
          accent="amber"
        />
        <StatCard
          label={CUSTOMER_ORDER_STATUS_LABELS.FULFILLED}
          value={numberFormatter.format(counts.FULFILLED)}
          icon={PackageCheck}
          accent="emerald"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                أحدث الطلبات
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                السجلات المحفوظة في قاعدة البيانات.
              </p>
            </div>
            <Link
              href="/sales/orders"
              className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
            >
              كل الطلبات <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-medium text-slate-200">لا توجد طلبات بعد.</p>
              {canManageOrders && (
                <Button className="mt-4" render={<Link href="/sales/orders/new" />}>
                  إنشاء أول طلب
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/sales/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-sky-300" dir="ltr">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-white">
                      {order.customerName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {order.lines
                        .map(
                          (line) =>
                            `${line.productName} · ${numberFormatter.format(line.orderedQuantity)} ${line.unit}`,
                        )
                        .join("، ")}
                      {order._count.lines > order.lines.length
                        ? `، +${order._count.lines - order.lines.length}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <CustomerOrderStatusBadge status={order.status} />
                    {order.expectedFulfillmentAt && (
                      <span className="text-xs text-slate-500">
                        متوقع{" "}
                        {dateFormatter.format(order.expectedFulfillmentAt)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Link
            href="/sales/customers"
            className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 transition hover:border-sky-400/20"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <UsersRound aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">
                سجل العملاء
              </span>
              <span className="mt-1 block text-sm text-slate-400">
                {numberFormatter.format(customerCount)} عميل مسجل
              </span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-4 text-slate-500" />
          </Link>
          {canManageCustomers && (
            <Button
              className="w-full"
              variant="outline"
              render={<Link href="/sales/customers/new" />}
            >
              <Plus aria-hidden="true" />
              إضافة عميل
            </Button>
          )}
          <div className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
            <h2 className="font-semibold text-white">حالة الطلبات</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(CUSTOMER_ORDER_STATUS_LABELS).map(
                ([status, label]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-400">{label}</span>
                    <Badge variant="outline" className="border-white/10 text-slate-200">
                      {numberFormatter.format(counts[status as CustomerOrderStatus])}
                    </Badge>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

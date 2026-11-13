import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerOrderStatusBadge } from "@/components/sales/CustomerOrderStatusBadge";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { ImportExportPanel } from "@/components/data-transfer/ImportExportPanel";
import {
  CUSTOMER_ORDER_STATUSES,
  CUSTOMER_ORDER_STATUS_LABELS,
  isCustomerOrderStatus,
} from "@/lib/sales-order-state";

const PAGE_SIZE = 15;
const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 6,
});
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ordersHref(query: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/sales/orders?${search}` : "/sales/orders";
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requirePagePermission("sales.read");
  await connection();
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const requestedStatus = firstValue(params.status) ?? "all";
  const status = isCustomerOrderStatus(requestedStatus)
    ? requestedStatus
    : "all";
  const rawPage = firstValue(params.page) ?? "";
  const parsedPage = /^\d+$/u.test(rawPage) ? Number(rawPage) : 1;
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const where: Prisma.CustomerOrderWhereInput = {
    ...(status === "all" ? {} : { status }),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            {
              customer: {
                is: { name: { contains: query, mode: "insensitive" } },
              },
            },
            {
              lines: {
                some: {
                  OR: [
                    { productName: { contains: query, mode: "insensitive" } },
                    { productSku: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
  const [total, count] = await Promise.all([
    prisma.customerOrder.count(),
    prisma.customerOrder.count({ where }),
  ]);
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const orders = await prisma.customerOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      createdAt: true,
      expectedFulfillmentAt: true,
      lines: {
        select: {
          productName: true,
          productSku: true,
          unit: true,
          orderedQuantity: true,
        },
        orderBy: { id: "asc" },
        take: 2,
      },
      _count: { select: { lines: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const canManage = hasPermission(principal.role, "sales.order.manage");

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/sales"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
            لوحة المبيعات
          </Link>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            المبيعات
          </p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            طلبات العملاء
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            ابحث في الطلبات المحفوظة وصفّها حسب الحالة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportExportPanel
            dataset="customer-orders"
            filters={{
              ...(query ? { q: query } : {}),
              ...(status !== "all" ? { status } : {}),
            }}
          />
          {canManage && (
            <Button render={<Link href="/sales/orders/new" />}>
              <Plus aria-hidden="true" />
              طلب جديد
            </Button>
          )}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <form
          method="get"
          action="/sales/orders"
          className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-end"
        >
          <label className="grid min-w-56 flex-1 gap-1.5 text-xs text-slate-400">
            ابحث برقم الطلب أو العميل أو المنتج
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              />
              <Input
                name="q"
                type="search"
                maxLength={100}
                defaultValue={query}
                className="h-10 border-white/[0.08] bg-slate-950 ps-10"
              />
            </div>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            حالة الطلب
            <select
              name="status"
              defaultValue={status}
              className="h-10 min-w-44 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="all">جميع الحالات</option>
              {CUSTOMER_ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CUSTOMER_ORDER_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="h-10">
            تطبيق
          </Button>
        </form>

        {orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">
              {query || status !== "all"
                ? "لا توجد طلبات تطابق البحث."
                : "لا توجد طلبات بعد."}
            </p>
            {canManage && !query && status === "all" && (
              <Button className="mt-4" render={<Link href="/sales/orders/new" />}>
                إنشاء أول طلب
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-start text-sm">
              <thead className="bg-white/[0.02] text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">رقم الطلب</th>
                  <th className="px-5 py-3 font-medium">العميل</th>
                  <th className="px-5 py-3 font-medium">الأصناف</th>
                  <th className="px-5 py-3 font-medium">تاريخ الإنشاء</th>
                  <th className="px-5 py-3 font-medium">الإنجاز المتوقع</th>
                  <th className="px-5 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-mono text-xs" dir="ltr">
                      <Link
                        href={`/sales/orders/${order.id}`}
                        className="text-sky-300 hover:text-sky-200 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-200">
                      {order.customerName}
                    </td>
                    <td className="max-w-80 px-5 py-4 text-slate-300">
                      {order.lines
                        .map(
                          (line) =>
                            `${line.productName} (${line.productSku}) · ${numberFormatter.format(line.orderedQuantity)} ${line.unit}`,
                        )
                        .join("، ")}
                      {order._count.lines > order.lines.length
                        ? `، +${order._count.lines - order.lines.length} صنف`
                        : ""}
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {dateFormatter.format(order.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {order.expectedFulfillmentAt
                        ? dateFormatter.format(order.expectedFulfillmentAt)
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <CustomerOrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 text-sm text-slate-400">
            <span>
              عرض {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, count)} من {count} نتيجة
              {query || status !== "all" ? ` · ${total} طلب إجمالًا` : ""}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={ordersHref(query, status, currentPage - 1)} />}
                >
                  السابق
                </Button>
              )}
              {currentPage < totalPages && (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={ordersHref(query, status, currentPage + 1)} />}
                >
                  التالي
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

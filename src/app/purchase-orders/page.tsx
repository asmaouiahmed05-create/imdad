import Link from "next/link";
import { connection } from "next/server";
import { Plus, Search, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/PurchaseOrderStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";

const PAGE_SIZE = 15;
const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
const statuses: PurchaseOrderStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];
const statusFilters: Record<string, PurchaseOrderStatus> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
};
const statusNames: Record<PurchaseOrderStatus, string> = {
  DRAFT: "المسودات",
  SUBMITTED: "المرسلة",
  PARTIALLY_RECEIVED: "استلام جزئي",
  RECEIVED: "المستلمة",
  CANCELLED: "الملغاة",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(query: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/purchase-orders?${search}` : "/purchase-orders";
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const requestedStatus = firstValue(params.status) ?? "all";
  const status = statusFilters[requestedStatus] ? requestedStatus : "all";
  const rawPage = firstValue(params.page) ?? "";
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const where = {
    ...(status === "all" ? {} : { status: statusFilters[status] }),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" as const } },
            {
              supplier: {
                name: { contains: query, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const [total, count] = await Promise.all([
    prisma.purchaseOrder.count(),
    prisma.purchaseOrder.count({ where }),
  ]);
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const orders = await prisma.purchaseOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      submittedAt: true,
      receivedAt: true,
      supplier: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const start = count ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(currentPage * PAGE_SIZE, count);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التوريد والمشتريات
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            أوامر الشراء
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            تابع الأصناف المطلوبة والاستلامات المرتبطة بحركات المخزون.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-slate-900 px-3 py-2 text-slate-300">
            {numberFormatter.format(total)} أمر
          </Badge>
          <Button render={<Link href="/purchase-orders/new" />}>
            <Plus aria-hidden="true" />
            إنشاء أمر شراء
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <form
          method="get"
          action="/purchase-orders"
          className="flex flex-wrap items-end gap-3 border-b border-white/[0.06] p-4 sm:p-5"
        >
          <label className="grid min-w-56 flex-1 gap-1.5 text-xs text-slate-400">
            البحث برقم الأمر أو المورد
            <div className="relative">
              <Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                type="search"
                maxLength={100}
                defaultValue={query}
                placeholder="رقم الأمر أو اسم المورد..."
                className="h-10 w-full rounded-lg border border-white/[0.1] bg-slate-950 ps-10 pe-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
              />
            </div>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            حالة الأمر
            <select
              name="status"
              defaultValue={status}
              className="h-10 min-w-44 rounded-lg border border-white/[0.1] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
            >
              <option value="all">جميع الحالات</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {statusNames[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="h-10">
            تطبيق
          </Button>
          {(query || status !== "all") && (
            <Link href="/purchase-orders" className="px-2 py-2 text-sm text-sky-300 hover:text-sky-200">
              مسح الفلاتر
            </Link>
          )}
        </form>

        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>رقم الأمر</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead>عدد الأصناف</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={`/purchase-orders/${order.id}`} className="font-mono font-medium text-sky-300 hover:text-sky-200" dir="ltr">
                    {order.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/suppliers/${order.supplier.id}`} className="text-slate-200 hover:text-white">
                    {order.supplier.name}
                  </Link>
                </TableCell>
                <TableCell>{dateFormatter.format(order.createdAt)}</TableCell>
                <TableCell>{numberFormatter.format(order._count.lines)}</TableCell>
                <TableCell><PurchaseOrderStatusBadge status={order.status} /></TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <ShoppingCart aria-hidden="true" className="size-8 text-slate-500" />
                    <p className="text-sm font-medium text-slate-200">
                      {query || status !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد أوامر شراء بعد"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {query || status !== "all"
                        ? "غيّر عبارة البحث أو حالة الأمر."
                        : "أنشئ مسودة أمر شراء من مورد نشط."}
                    </p>
                    {!query && status === "all" && (
                      <Link href="/purchase-orders/new" className="mt-1 text-sm text-sky-300">
                        إنشاء أمر شراء
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <nav
          aria-label="صفحات أوامر الشراء"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4 text-xs text-slate-400 sm:px-5"
        >
          <p aria-live="polite">
            عرض {numberFormatter.format(start)}–{numberFormatter.format(end)} من{" "}
            {numberFormatter.format(count)} أمر
          </p>
          <div className="flex items-center gap-2">
            <span>الصفحة {numberFormatter.format(currentPage)} من {numberFormatter.format(Math.max(totalPages, 1))}</span>
            {currentPage > 1 ? (
              <Link href={href(query, status, currentPage - 1)} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">السابقة</Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg border border-white/5 px-3 py-2 text-slate-600">السابقة</span>
            )}
            {currentPage < totalPages ? (
              <Link href={href(query, status, currentPage + 1)} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">التالية</Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg border border-white/5 px-3 py-2 text-slate-600">التالية</span>
            )}
          </div>
        </nav>
      </section>
    </main>
  );
}

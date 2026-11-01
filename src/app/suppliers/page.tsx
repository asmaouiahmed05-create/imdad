import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowDownWideNarrow,
  Building2,
  ClipboardList,
  Plus,
  Search,
  Truck,
  UserCheck,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { SupplierStatusControl } from "@/components/purchasing/SupplierStatusControl";

const PAGE_SIZE = 15;
const numberFormatter = new Intl.NumberFormat("ar-DZ");
const summaryCards = [
  { label: "إجمالي الموردين", key: "total", icon: Building2, color: "text-sky-300" },
  { label: "الموردون النشطون", key: "active", icon: UserCheck, color: "text-emerald-300" },
  { label: "الموردون غير النشطين", key: "inactive", icon: UserX, color: "text-slate-400" },
  { label: "أوامر الشراء المرتبطة", key: "orders", icon: ClipboardList, color: "text-violet-300" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(query: string, active: string, sort: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (active !== "all") params.set("active", active);
  if (sort !== "name") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/suppliers?${search}` : "/suppliers";
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requirePagePermission("supplier.read");
  const canManage = hasPermission(principal.role, "supplier.manage");
  await connection();
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const activeValue = firstValue(params.active);
  const active = activeValue === "active" || activeValue === "inactive"
    ? activeValue
    : "all";
  const sortValue = firstValue(params.sort);
  const sort = sortValue === "name-desc" || sortValue === "orders" || sortValue === "recent"
    ? sortValue
    : "name";
  const rawPage = firstValue(params.page) ?? "";
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const where = {
    ...(active === "all" ? {} : { isActive: active === "active" }),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { contactPerson: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const orderBy =
    sort === "orders"
      ? [{ purchaseOrders: { _count: "desc" as const } }, { name: "asc" as const }]
      : sort === "recent"
        ? [{ updatedAt: "desc" as const }, { name: "asc" as const }]
        : [{ name: sort === "name-desc" ? "desc" as const : "asc" as const }];

  const [total, activeCount, inactiveCount, purchaseOrderCount, count] = await Promise.all([
    prisma.supplier.count(),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: false } }),
    prisma.purchaseOrder.count(),
    prisma.supplier.count({ where }),
  ]);
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const suppliers = await prisma.supplier.findMany({
    where,
    select: {
      id: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      isActive: true,
      _count: { select: { purchaseOrders: true } },
    },
    orderBy,
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
            المشتريات وسلسلة التوريد
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            إدارة الموردين
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            سجل الموردين وحالاتهم وارتباطهم بأوامر الشراء.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-slate-900 px-3 py-2 text-slate-300">
            {numberFormatter.format(total)} مورد
          </Badge>
          {canManage && (
            <Button render={<Link href="/suppliers/new" />}>
              <Plus aria-hidden="true" />
              إضافة مورد
            </Button>
          )}
        </div>
      </section>

      <section
        aria-label="ملخص الموردين"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map(({ label, key, icon: Icon, color }) => {
          const value = {
            total,
            active: activeCount,
            inactive: inactiveCount,
            orders: purchaseOrderCount,
          }[key];
          return (
            <Card key={key} className="border border-white/[0.07] bg-slate-900/75 text-slate-100 ring-0">
              <CardContent className="flex items-center justify-between gap-3 py-1">
                <div>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {numberFormatter.format(value)}
                  </p>
                </div>
                <div className={`grid size-10 place-items-center rounded-xl bg-white/[0.04] ${color}`}>
                  <Icon aria-hidden="true" className="size-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <form
          method="get"
          action="/suppliers"
          className="flex flex-wrap items-end gap-3 border-b border-white/[0.06] p-4 sm:p-5"
        >
          <label className="grid min-w-56 flex-1 gap-1.5 text-xs text-slate-400">
            البحث في بيانات المورد
            <div className="relative">
              <Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                type="search"
                maxLength={100}
                defaultValue={query}
                placeholder="الاسم، جهة الاتصال، الهاتف أو البريد..."
                className="h-10 w-full rounded-lg border border-white/[0.1] bg-slate-950 ps-10 pe-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
              />
            </div>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            حالة المورد
            <select
              name="active"
              defaultValue={active}
              className="h-10 min-w-40 rounded-lg border border-white/[0.1] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
            >
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            الترتيب
            <span className="relative">
              <ArrowDownWideNarrow aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <select
                name="sort"
                defaultValue={sort}
                className="h-10 min-w-48 rounded-lg border border-white/[0.1] bg-slate-950 ps-9 pe-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
              >
                <option value="name">الاسم: أ إلى ي</option>
                <option value="name-desc">الاسم: ي إلى أ</option>
                <option value="orders">الأكثر ارتباطًا بأوامر الشراء</option>
                <option value="recent">آخر تحديث</option>
              </select>
            </span>
          </label>
          <Button type="submit" variant="outline" className="h-10">
            تطبيق
          </Button>
          {(query || active !== "all") && (
            <Link href="/suppliers" className="px-2 py-2 text-sm text-sky-300 hover:text-sky-200">
              مسح الفلاتر
            </Link>
          )}
        </form>

        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>المورد</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>أوامر الشراء</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="font-medium text-slate-100 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                    >
                      {supplier.name}
                    </Link>
                  </TableCell>
                  <TableCell>{supplier.contactPerson || "—"}</TableCell>
                  <TableCell dir="auto">{supplier.phone || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-start">{supplier.email || "—"}</TableCell>
                  <TableCell>{numberFormatter.format(supplier._count.purchaseOrders)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        supplier.isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                      }
                    >
                      {supplier.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/suppliers/${supplier.id}`} />}
                      >
                        التفاصيل
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link href={`/suppliers/${supplier.id}/edit`} />}
                          >
                            تعديل
                          </Button>
                          <SupplierStatusControl
                            supplierId={supplier.id}
                            supplierName={supplier.name}
                            isActive={supplier.isActive}
                            purchaseOrderCount={supplier._count.purchaseOrders}
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <Truck aria-hidden="true" className="size-8 text-slate-500" />
                      <p className="text-sm font-medium text-slate-200">
                        {query || active !== "all" ? "لا توجد نتائج مطابقة" : "لا يوجد موردون بعد"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {query || active !== "all"
                          ? "غيّر عبارة البحث أو حالة المورد."
                          : "أضف المورد الأول لبدء إنشاء أوامر الشراء."}
                      </p>
                      {!query && active === "all" && canManage && (
                        <Link href="/suppliers/new" className="mt-1 text-sm text-sky-300">
                          إضافة مورد
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <nav
          aria-label="صفحات الموردين"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4 text-xs text-slate-400 sm:px-5"
        >
          <p aria-live="polite">
            عرض {numberFormatter.format(start)}–{numberFormatter.format(end)} من{" "}
            {numberFormatter.format(count)} مورد
          </p>
          <div className="flex items-center gap-2">
            <span>الصفحة {numberFormatter.format(currentPage)} من {numberFormatter.format(Math.max(totalPages, 1))}</span>
            {currentPage > 1 ? (
              <Link href={href(query, active, sort, currentPage - 1)} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
                السابقة
              </Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg border border-white/5 px-3 py-2 text-slate-600">السابقة</span>
            )}
            {currentPage < totalPages ? (
              <Link href={href(query, active, sort, currentPage + 1)} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
                التالية
              </Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg border border-white/5 px-3 py-2 text-slate-600">التالية</span>
            )}
          </div>
        </nav>
      </section>
    </main>
  );
}

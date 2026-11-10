import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 15;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function listHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/sales/customers?${search}` : "/sales/customers";
}

export default async function SalesCustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requirePagePermission("sales.read");
  await connection();
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const rawPage = firstValue(params.page) ?? "";
  const parsedPage = /^\d+$/u.test(rawPage) ? Number(rawPage) : 1;
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const where: Prisma.CustomerWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { contactPerson: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, count] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where }),
  ]);
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      city: true,
      address: true,
      isActive: true,
      _count: { select: { orders: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const canManage = hasPermission(principal.role, "sales.customer.manage");

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
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
          <h1 className="text-xl font-semibold text-white sm:text-2xl">العملاء</h1>
          <p className="mt-2 text-sm text-slate-400">
            بيانات العملاء المرتبطة بطلباتهم المسجلة.
          </p>
        </div>
        {canManage && (
          <Button render={<Link href="/sales/customers/new" />}>
            <Plus aria-hidden="true" />
            إضافة عميل
          </Button>
        )}
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <form
          method="get"
          action="/sales/customers"
          className="flex flex-wrap items-end gap-3 border-b border-white/[0.06] p-4 sm:p-5"
        >
          <label className="grid min-w-56 flex-1 gap-1.5 text-xs text-slate-400">
            ابحث بالاسم أو جهة الاتصال أو الهاتف أو المدينة
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
          <Button type="submit" variant="outline" className="h-10">
            بحث
          </Button>
        </form>

        {customers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">
              {query ? "لا يوجد عملاء يطابقون البحث." : "لا يوجد عملاء مسجلون بعد."}
            </p>
            {canManage && !query && (
              <Button className="mt-4" render={<Link href="/sales/customers/new" />}>
                إضافة أول عميل
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {customers.map((customer) => (
              <article
                key={customer.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-white">{customer.name}</h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        customer.isActive
                          ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"
                          : "border-slate-400/20 bg-slate-400/[0.06] text-slate-300"
                      }`}
                    >
                      {customer.isActive ? "نشط" : "غير نشط"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {[customer.contactPerson, customer.city]
                      .filter(Boolean)
                      .join(" · ") || "لا توجد بيانات إضافية"}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {customer.phone && <span dir="ltr">{customer.phone}</span>}
                    {customer.email && <span dir="ltr">{customer.email}</span>}
                    <span>{customer._count.orders} طلب</span>
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/sales/customers/${customer.id}/edit`} />}
                  >
                    تعديل البيانات
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}

        {count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 text-sm text-slate-400">
            <span>
              عرض {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, count)} من {count} نتيجة
              {query ? ` · ${total} عميل إجمالًا` : ""}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Button variant="outline" size="sm" render={<Link href={listHref(query, currentPage - 1)} />}>
                  السابق
                </Button>
              )}
              {currentPage < totalPages && (
                <Button variant="outline" size="sm" render={<Link href={listHref(query, currentPage + 1)} />}>
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

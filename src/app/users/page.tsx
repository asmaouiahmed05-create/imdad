import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserManagement } from "@/components/users/UserManagement";
import { isAccountDisabled, isAppRole } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(page: number) {
  return page > 1 ? `/users?page=${page}` : "/users";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const principal = await requirePagePermission("users.manage");
  await connection();

  const params = await searchParams;
  const rawPage = firstValue(params.page) ?? "";
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const requestedPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const total = await prisma.user.count();
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banExpires: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            إدارة الحسابات
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            المستخدمون والصلاحيات
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            أنشئ الحسابات وأدر أدوارها وحالة الوصول إليها.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-white/10 bg-slate-900 px-3 py-2 text-slate-300"
        >
          {new Intl.NumberFormat("ar-DZ").format(total)} حساب
        </Badge>
      </section>

      <UserManagement
        currentUserId={principal.id}
        users={users.map((user) => ({
          ...user,
          role: isAppRole(user.role) ? user.role : null,
          disabled: isAccountDisabled({
            banned: user.banned,
            banExpires: user.banExpires,
          }),
          createdAt: user.createdAt.toISOString(),
        }))}
      />

      {totalPages > 1 && (
        <nav
          aria-label="صفحات المستخدمين"
          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-slate-900/60 p-4"
        >
          <p className="text-sm text-slate-400">
            الصفحة {new Intl.NumberFormat("ar-DZ").format(currentPage)} من{" "}
            {new Intl.NumberFormat("ar-DZ").format(totalPages)}
          </p>
          <div className="flex gap-2">
            <Button
              render={<Link href={pageHref(Math.max(1, currentPage - 1))} />}
              variant="outline"
              disabled={currentPage === 1}
            >
              السابقة
            </Button>
            <Button
              render={
                <Link href={pageHref(Math.min(totalPages, currentPage + 1))} />
              }
              variant="outline"
              disabled={currentPage === totalPages}
            >
              التالية
            </Button>
          </div>
        </nav>
      )}
    </main>
  );
}

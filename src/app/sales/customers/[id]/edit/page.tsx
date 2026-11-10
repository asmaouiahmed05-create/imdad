import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CustomerForm } from "@/components/sales/CustomerForm";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("sales.customer.manage");
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/sales/customers"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        العملاء
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          المبيعات
        </p>
        <h1 className="mb-2 text-xl font-semibold text-white">
          تعديل بيانات العميل
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          لا يؤدي تعطيل العميل إلى حذف سجل طلباته السابقة.
        </p>
        <CustomerForm customer={customer} />
      </section>
    </main>
  );
}

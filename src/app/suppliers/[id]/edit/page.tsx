import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SupplierForm } from "@/components/purchasing/SupplierForm";
import type { SupplierFormValue } from "@/components/purchasing/SupplierForm";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("supplier.manage");
  await connection();
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();
  const initial: SupplierFormValue = {
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href={`/suppliers/${id}`} className="text-sm text-slate-400 hover:text-white">
        العودة إلى المورد
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          سجل الموردين
        </p>
        <h2 className="mb-2 text-xl font-semibold text-white">تعديل بيانات المورد</h2>
        <p className="mb-6 text-sm text-slate-400">
          تغيير حالة التفعيل متاح من صفحة التفاصيل ويتطلب تأكيدًا منفصلًا.
        </p>
        <SupplierForm supplier={initial} />
      </section>
    </main>
  );
}

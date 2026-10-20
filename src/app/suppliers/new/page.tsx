import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SupplierForm } from "@/components/purchasing/SupplierForm";

export default function NewSupplierPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        الموردون
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          سجل الموردين
        </p>
        <h2 className="mb-6 text-xl font-semibold text-white">إضافة مورد</h2>
        <SupplierForm />
      </section>
    </main>
  );
}

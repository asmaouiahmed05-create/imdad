import Link from "next/link";
import { ArrowRight, Building2, MapPin, Phone } from "lucide-react";
import { DEMO_CUSTOMERS } from "@/lib/sales-demo";

export default function SalesCustomersPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
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
        <h2 className="text-xl font-semibold text-white sm:text-2xl">
          العملاء
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          جهات اتصال تجريبية لاستخدامها في طلبات العملاء.
        </p>
      </div>

      <p
        role="note"
        className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200"
      >
        هذه بيانات عرض ثابتة، ولا تمثل سجلات عملاء محفوظة في النظام.
      </p>

      <section
        aria-label="قائمة العملاء"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {DEMO_CUSTOMERS.map((customer) => (
          <article
            key={customer.id}
            className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
                <Building2 aria-hidden="true" className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold leading-6 text-white">
                  {customer.name}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  {customer.city}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
              <p className="flex items-center gap-2 text-slate-300" dir="ltr">
                <Phone aria-hidden="true" className="size-4 text-slate-500" />
                {customer.phone}
              </p>
              <p className="break-all text-slate-400" dir="ltr">
                {customer.email}
              </p>
            </div>
            <Link
              href={`/sales/orders/new?customer=${encodeURIComponent(customer.id)}`}
              className="mt-5 inline-flex text-sm font-medium text-sky-300 hover:text-sky-200"
            >
              إنشاء طلب لهذا العميل
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

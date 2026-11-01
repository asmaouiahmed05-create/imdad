import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SalesOrderForm } from "@/components/sales/SalesOrderForm";
import { DEMO_CUSTOMERS } from "@/lib/sales-demo";

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string | string[] }>;
}) {
  const params = await searchParams;
  const customerId = Array.isArray(params.customer)
    ? params.customer[0]
    : params.customer;
  const defaultCustomerId = DEMO_CUSTOMERS.some(
    (customer) => customer.id === customerId,
  )
    ? customerId
    : undefined;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/sales/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        طلبات العملاء
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          المبيعات
        </p>
        <h2 className="mb-2 text-xl font-semibold text-white">
          إنشاء طلب عميل
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          أدخل بيانات الطلب والموعد المتوقع للتسليم.
        </p>
        <SalesOrderForm defaultCustomerId={defaultCustomerId} />
      </section>
    </main>
  );
}

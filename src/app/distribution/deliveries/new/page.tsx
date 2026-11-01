import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DeliveryForm } from "@/components/distribution/DeliveryForm";

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedOrderId = Array.isArray(params.order)
    ? params.order[0]
    : params.order;
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/distribution"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        التوزيع
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          التوزيع
        </p>
        <h2 className="mb-2 text-xl font-semibold text-white">
          إنشاء سجل توصيل
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          اختر طلبًا مؤكدًا أو جاهزًا، ثم أدخل تفاصيل التوصيل.
        </p>
        <DeliveryForm defaultOrderId={requestedOrderId} />
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductionOrderForm } from "@/components/production/ProductionOrderForm";
import { requirePagePermission } from "@/lib/authz";
import { isRecordId } from "@/lib/production-bom";
import { getReleasedProductionBomOptions } from "@/lib/production-order-data";

type SearchParams = Promise<{ bomId?: string | string[] }>;

export default async function NewProductionOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("production.order.manage");
  const params = await searchParams;
  const selectedBomId = Array.isArray(params.bomId)
    ? params.bomId[0]
    : params.bomId;
  if (selectedBomId && !isRecordId(selectedBomId)) notFound();

  const bomOptions = await getReleasedProductionBomOptions();
  if (selectedBomId && !bomOptions.some((bom) => bom.id === selectedBomId)) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/production"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        الإنتاج
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          تخطيط الإنتاج
        </p>
        <h1 className="mb-2 text-xl font-semibold text-white">
          إنشاء أمر إنتاج
        </h1>
        <p className="mb-6 text-sm leading-6 text-slate-400">
          اختر مراجعة معتمدة وحدد الكمية. سيُعاد احتساب احتياجات المواد والتحقق
          من المخزون عند بدء الإنتاج وإكماله.
        </p>
        <ProductionOrderForm
          boms={bomOptions}
          selectedBomId={selectedBomId}
        />
      </section>
    </main>
  );
}

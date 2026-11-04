import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductionOrderForm } from "@/components/production/ProductionOrderForm";
import { requirePagePermission } from "@/lib/authz";
import { isRecordId } from "@/lib/production-bom";
import { getReleasedProductionBomOptions } from "@/lib/production-order-data";
import { prisma } from "@/lib/db";

export default async function EditProductionOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("production.order.manage");
  const { id } = await params;
  if (!isRecordId(id)) notFound();

  const order = await prisma.productionOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      bomId: true,
      plannedQuantity: true,
      plannedStartDate: true,
      expectedCompletionDate: true,
      notes: true,
    },
  });
  if (!order) notFound();
  if (order.status !== "DRAFT") redirect(`/production/orders/${id}`);

  const boms = await getReleasedProductionBomOptions();
  if (boms.length === 0) redirect(`/production/orders/${id}`);
  const orderBomIsActive = boms.some((bom) => bom.id === order.bomId);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href={`/production/orders/${id}`}
        className="text-sm text-slate-400 hover:text-white"
      >
        تفاصيل أمر الإنتاج
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          تعديل مسودة
        </p>
        <h1 className="mb-2 text-xl font-semibold text-white">
          تعديل أمر الإنتاج
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          يمكن تعديل المسودة فقط. يجب أن تبقى قائمة المواد معتمدة ونشطة.
        </p>
        {!orderBomIsActive && (
          <p className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
            مراجعة القائمة السابقة لم تعد نشطة. اختر مراجعة معتمدة بديلة قبل
            حفظ المسودة.
          </p>
        )}
        <ProductionOrderForm
          boms={boms}
          initialOrder={{
            id: order.id,
            bomId: orderBomIsActive ? order.bomId : boms[0].id,
            plannedQuantity: order.plannedQuantity.toString(),
            plannedStartDate:
              order.plannedStartDate?.toISOString().slice(0, 10) ?? "",
            expectedCompletionDate:
              order.expectedCompletionDate?.toISOString().slice(0, 10) ?? "",
            notes: order.notes ?? "",
          }}
        />
      </section>
    </main>
  );
}

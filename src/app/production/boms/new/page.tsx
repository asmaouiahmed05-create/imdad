import Link from "next/link";
import { notFound } from "next/navigation";
import { BomForm } from "@/components/production/BomForm";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { isRecordId } from "@/lib/production-bom";

type SearchParams = Promise<{ sourceId?: string | string[] }>;

export default async function NewBillOfMaterialsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("production.bom.manage");
  const params = await searchParams;
  const sourceId = Array.isArray(params.sourceId)
    ? params.sourceId[0]
    : params.sourceId;
  if (sourceId && !isRecordId(sourceId)) notFound();
  const [finishedProducts, materials, source] = await Promise.all([
    prisma.product.findMany({
      where: { classification: { in: ["FINISHED_GOOD", "BOTH"] } },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        classification: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { classification: { in: ["MATERIAL", "BOTH"] } },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        classification: true,
      },
      orderBy: { name: "asc" },
    }),
    sourceId
      ? prisma.billOfMaterials.findUnique({
          where: { id: sourceId },
          include: {
            finishedProduct: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                classification: true,
              },
            },
            components: {
              select: {
                materialProductId: true,
                quantityPerUnit: true,
              },
              orderBy: { materialName: "asc" },
            },
          },
        })
      : Promise.resolve(null),
  ]);
  if (sourceId && (!source || source.status === "DRAFT")) notFound();

  if (
    source &&
    !finishedProducts.some((product) => product.id === source.finishedProductId)
  ) {
    finishedProducts.push(source.finishedProduct);
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/production/boms"
        className="text-sm text-slate-400 hover:text-white"
      >
        قوائم المواد
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          إعداد بيانات الإنتاج
        </p>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">
          {source ? "إنشاء مراجعة جديدة" : "إنشاء قائمة مواد"}
        </h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-400">
          ستُحفظ القائمة كمسودة. لا تؤثر هذه العملية في الكميات أو حركات المخزون.
        </p>
        <BomForm
          finishedProducts={finishedProducts}
          materials={materials}
          sourceId={source?.id}
          initialBom={
            source
              ? {
                  id: source.id,
                  revision: source.revision,
                  finishedProductId: source.finishedProductId,
                  components: source.components.map((component) => ({
                    materialProductId: component.materialProductId,
                    quantityPerUnit: component.quantityPerUnit.toString(),
                  })),
                }
              : undefined
          }
        />
      </section>
    </main>
  );
}

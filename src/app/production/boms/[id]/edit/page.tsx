import Link from "next/link";
import { redirect } from "next/navigation";
import { BomForm } from "@/components/production/BomForm";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";

export default async function EditBillOfMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("production.bom.manage");
  const { id } = await params;
  const bom = await prisma.billOfMaterials.findUnique({
    where: { id },
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
        select: { materialProductId: true, quantityPerUnit: true },
        orderBy: { materialName: "asc" },
      },
    },
  });
  if (!bom) redirect("/production/boms");
  if (bom.status !== "DRAFT") redirect(`/production/boms/${bom.id}`);

  const [finishedProducts, materials] = await Promise.all([
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
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href={`/production/boms/${bom.id}`}
        className="text-sm text-slate-400 hover:text-white"
      >
        تفاصيل قائمة المواد
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">
          تعديل مسودة المراجعة {bom.revision}
        </h1>
        <p className="mb-6 mt-2 text-sm text-slate-400">
          المنتج النهائي ثابت لهذه المراجعة؛ بعد اعتمادها لا يمكن تعديلها.
        </p>
        <BomForm
          finishedProducts={[
            ...finishedProducts,
            ...(finishedProducts.some(
              (product) => product.id === bom.finishedProductId,
            )
              ? []
              : [bom.finishedProduct]),
          ]}
          materials={materials}
          initialBom={{
            id: bom.id,
            revision: bom.revision,
            finishedProductId: bom.finishedProductId,
            components: bom.components.map((component) => ({
              materialProductId: component.materialProductId,
              quantityPerUnit: component.quantityPerUnit.toString(),
            })),
          }}
        />
      </section>
    </main>
  );
}

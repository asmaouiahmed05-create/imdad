import "server-only";
import { prisma } from "@/lib/db";

export async function getReleasedProductionBomOptions() {
  const boms = await prisma.billOfMaterials.findMany({
    where: { status: "RELEASED" },
    include: {
      components: {
        include: {
          materialProduct: { select: { quantity: true } },
        },
        orderBy: { materialName: "asc" },
      },
    },
    orderBy: [{ finishedProductName: "asc" }, { revision: "desc" }],
  });
  return boms.map((bom) => ({
    id: bom.id,
    revision: bom.revision,
    finishedProductId: bom.finishedProductId,
    finishedProductName: bom.finishedProductName,
    finishedProductSku: bom.finishedProductSku,
    finishedProductUnit: bom.finishedProductUnit,
    components: bom.components.map((component) => ({
      materialProductId: component.materialProductId,
      materialName: component.materialName,
      materialSku: component.materialSku,
      unit: component.unit,
      quantityPerUnit: component.quantityPerUnit.toString(),
      availableQuantity: component.materialProduct.quantity,
    })),
  }));
}

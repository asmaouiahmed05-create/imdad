import { notFound } from "next/navigation";
import { ProductionOrderDetail } from "@/components/production/ProductionOrderDetail";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { isRecordId } from "@/lib/production-bom";

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requirePagePermission("production.order.read");
  const { id } = await params;
  if (!isRecordId(id)) notFound();

  const order = await prisma.productionOrder.findUnique({
    where: { id },
    include: {
      bom: {
        include: {
          components: {
            include: {
              materialProduct: { select: { quantity: true } },
            },
            orderBy: { materialName: "asc" },
          },
        },
      },
      movements: {
        include: {
          product: { select: { name: true, sku: true, unit: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!order) notFound();

  return (
    <ProductionOrderDetail
      canManage={hasPermission(principal.role, "production.order.manage")}
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        plannedQuantity: order.plannedQuantity.toString(),
        producedQuantity: order.producedQuantity?.toString() ?? null,
        plannedStartDate: order.plannedStartDate?.toISOString() ?? null,
        expectedCompletionDate:
          order.expectedCompletionDate?.toISOString() ?? null,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        bom: {
          revision: order.bom.revision,
          status: order.bom.status,
          finishedProductId: order.bom.finishedProductId,
          finishedProductName: order.bom.finishedProductName,
          finishedProductSku: order.bom.finishedProductSku,
          finishedProductUnit: order.bom.finishedProductUnit,
          components: order.bom.components.map((component) => ({
            materialProductId: component.materialProductId,
            materialName: component.materialName,
            materialSku: component.materialSku,
            unit: component.unit,
            quantityPerUnit: component.quantityPerUnit.toString(),
            availableQuantity: component.materialProduct.quantity,
          })),
        },
        movements: order.movements.map((movement) => ({
          type: movement.type,
          quantity: movement.quantity,
          reason: movement.reason,
          createdAt: movement.createdAt.toISOString(),
          productName: movement.product.name,
          productSku: movement.product.sku,
          unit: movement.product.unit,
        })),
      }}
    />
  );
}

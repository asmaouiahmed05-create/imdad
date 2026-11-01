import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { inventoryStatusWhere } from "@/lib/inventory-status";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";
import { requirePagePermission } from "@/lib/authz";
import { ControlTowerDashboard } from "@/components/control-tower/ControlTowerDashboard";

export default async function ControlTowerPage() {
  await Promise.all([
    requirePagePermission("inventory.read"),
    requirePagePermission("supplier.read"),
    requirePagePermission("purchase_order.read"),
  ]);
  await connection();

  const [
    productCount,
    lowStockCount,
    outOfStockCount,
    lowStockProducts,
    supplierCount,
    activeSupplierCount,
    purchaseOrderCounts,
    recentPurchaseOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: inventoryStatusWhere("low") }),
    prisma.product.count({ where: inventoryStatusWhere("out") }),
    prisma.product.findMany({
      where: {
        OR: [
          inventoryStatusWhere("low"),
          inventoryStatusWhere("out"),
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        minQuantity: true,
        unit: true,
      },
      orderBy: [{ quantity: "asc" }, { name: "asc" }],
      take: 5,
    }),
    prisma.supplier.count(),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.purchaseOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        supplier: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);

  const countsByPurchaseStatus: Record<PurchaseOrderStatus, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    PARTIALLY_RECEIVED: 0,
    RECEIVED: 0,
    CANCELLED: 0,
  };
  for (const entry of purchaseOrderCounts) {
    countsByPurchaseStatus[entry.status] = entry._count._all;
  }

  return (
    <ControlTowerDashboard
      data={{
        inventory: {
          productCount,
          lowStockCount,
          outOfStockCount,
          lowStockProducts,
        },
        procurement: {
          supplierCount,
          activeSupplierCount,
          purchaseOrderCounts: countsByPurchaseStatus,
          recentPurchaseOrders,
        },
      }}
    />
  );
}

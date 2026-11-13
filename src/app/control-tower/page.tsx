import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { inventoryStatusWhere } from "@/lib/inventory-status";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";
import {
  PRODUCTION_ORDER_STATUSES,
  type ProductionOrderStatusValue,
} from "@/lib/production-orders";
import {
  CUSTOMER_ORDER_STATUSES,
  type CustomerOrderStatus,
} from "@/lib/sales-order-state";
import {
  DELIVERY_SHIPMENT_STATUSES,
  type DeliveryShipmentStatus,
} from "@/lib/delivery-state";
import { requirePagePermission } from "@/lib/authz";
import { ControlTowerDashboard } from "@/components/control-tower/ControlTowerDashboard";
import { ImportExportPanel } from "@/components/data-transfer/ImportExportPanel";

export default async function ControlTowerPage() {
  await Promise.all([
    requirePagePermission("inventory.read"),
    requirePagePermission("supplier.read"),
    requirePagePermission("purchase_order.read"),
    requirePagePermission("production.order.read"),
    requirePagePermission("sales.read"),
    requirePagePermission("distribution.read"),
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
    productionOrderCounts,
    recentProductionOrders,
    customerOrderCounts,
    recentCustomerOrders,
    deliveryShipmentCounts,
    recentDeliveryShipments,
    delayedShipmentCount,
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
    prisma.productionOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.productionOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        status: true,
        plannedQuantity: true,
        bom: {
          select: {
            revision: true,
            finishedProductName: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 4,
    }),
    prisma.customerOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.customerOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        lines: {
          select: { productName: true },
          orderBy: { id: "asc" },
          take: 3,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 4,
    }),
    prisma.deliveryShipment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.deliveryShipment.findMany({
      select: {
        id: true,
        reference: true,
        status: true,
        expectedDeliveryAt: true,
        customerName: true,
        region: true,
      },
      where: {
        OR: [
          { status: { in: ["PREPARING", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT"] } },
          { status: "DELIVERY_FAILED" },
        ],
      },
      orderBy: [{ expectedDeliveryAt: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.deliveryShipment.count({
      where: {
        status: {
          in: ["PREPARING", "READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT"],
        },
        expectedDeliveryAt: { lt: new Date() },
      },
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

  const countsByProductionStatus = Object.fromEntries(
    PRODUCTION_ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<ProductionOrderStatusValue, number>;
  for (const entry of productionOrderCounts) {
    countsByProductionStatus[entry.status] = entry._count._all;
  }
  const countsByCustomerStatus = Object.fromEntries(
    CUSTOMER_ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<CustomerOrderStatus, number>;
  for (const entry of customerOrderCounts) {
    countsByCustomerStatus[entry.status] = entry._count._all;
  }
  const countsByDeliveryStatus = Object.fromEntries(
    DELIVERY_SHIPMENT_STATUSES.map((status) => [status, 0]),
  ) as Record<DeliveryShipmentStatus, number>;
  for (const entry of deliveryShipmentCounts) {
    countsByDeliveryStatus[entry.status] = entry._count._all;
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1600px] justify-end px-4 pt-4 sm:px-6 lg:px-8">
        <ImportExportPanel dataset="executive" />
      </div>
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
        production: {
          orderCounts: countsByProductionStatus,
          recentOrders: recentProductionOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            plannedQuantity: order.plannedQuantity.toString(),
            finishedProductName: order.bom.finishedProductName,
            revision: order.bom.revision,
          })),
        },
        sales: {
          orderCounts: countsByCustomerStatus,
          recentOrders: recentCustomerOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            status: order.status,
            products: order.lines.map((line) => line.productName),
          })),
        },
        distribution: {
          shipmentCounts: countsByDeliveryStatus,
          recentShipments: recentDeliveryShipments,
          delayedShipmentCount,
        },
        }}
      />
    </>
  );
}

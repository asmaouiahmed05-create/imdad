import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Factory,
  PackageCheck,
  PackageOpen,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  AnalyticsSection,
  type AnalyticsModule,
  type AnalyticsStatus,
} from "@/components/dashboard/AnalyticsSection";
import { ExecutiveMetricCard } from "@/components/dashboard/ExecutiveMetricCard";
import type { ExecutiveMetric } from "@/components/dashboard/ExecutiveMetricCard";
import {
  AlertsCenter,
  type OperationalAlert,
} from "@/components/dashboard/AlertsCenter";
import {
  RecentActivityTimeline,
  type TimelineActivity,
} from "@/components/dashboard/RecentActivityTimeline";
import {
  createSupplyChainStageMetrics,
  SupplyChainOverview,
} from "@/components/dashboard/SupplyChainOverview";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { inventoryStatusWhere } from "@/lib/inventory-status";

const countFormatter = new Intl.NumberFormat("ar-DZ");
const quantityFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});
const activityQuantityFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});
const analyticsDateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  month: "short",
  day: "numeric",
  timeZone: "Africa/Algiers",
});
const analyticsMonthFormatter = new Intl.DateTimeFormat("ar-DZ", {
  year: "2-digit",
  month: "short",
  timeZone: "Africa/Algiers",
});

type StatusCount = {
  status: string;
  _count: { _all: number };
};

function countForStatus(groups: StatusCount[] | null, status: string) {
  return groups?.find((group) => group.status === status)?._count._all ?? 0;
}

function totalCount(groups: StatusCount[] | null) {
  return groups?.reduce((total, group) => total + group._count._all, 0) ?? 0;
}

function formatAnalyticsRows(rows: AnalyticsTrendRow[], bucketSize: string) {
  return rows.map(({ bucket, ...values }) => ({
    date:
      bucketSize === "month"
        ? analyticsMonthFormatter.format(bucket)
        : analyticsDateFormatter.format(bucket),
    ...values,
  }));
}

function formatAnalyticsStatuses(
  groups: StatusCount[] | null,
  statusLabels: Record<string, { label: string; color: string }>,
): AnalyticsStatus[] {
  return (groups ?? []).map((group) => ({
    label: statusLabels[group.status]?.label ?? group.status,
    value: group._count._all,
    color: statusLabels[group.status]?.color ?? "#94a3b8",
  }));
}

type AnalyticsTrendRow = {
  bucket: Date;
  inbound?: number;
  outbound?: number;
  created?: number;
  received?: number;
  completed?: number;
  cancelled?: number;
  fulfilled?: number;
  delivered?: number;
  failed?: number;
};

type DashboardSearchParams = Promise<{
  period?: string | string[];
}>;

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ExecutiveDashboard({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const principal = await getAuthenticatedPrincipal();
  if (!principal) redirect("/login");

  await connection();
  const params = await searchParams;
  const requestedPeriod = firstSearchValue(params.period);
  const period =
    requestedPeriod === "7d" ||
    requestedPeriod === "30d" ||
    requestedPeriod === "90d" ||
    requestedPeriod === "all"
      ? requestedPeriod
      : "30d";
  const periodDays = { "7d": 7, "30d": 30, "90d": 90 } as const;
  const [{ periodStart }] = await prisma.$queryRaw<
    { periodStart: Date | null }[]
  >`
    SELECT CASE
      WHEN ${period === "all"} THEN NULL::timestamptz
      ELSE now() - (${period === "7d" ? periodDays["7d"] : period === "90d" ? periodDays["90d"] : periodDays["30d"]} * interval '1 day')
    END AS "periodStart"
  `;
  const bucketSize = period === "all" ? "month" : "day";

  const canReadInventory = hasPermission(principal.role, "inventory.read");
  const canReadSuppliers = hasPermission(principal.role, "supplier.read");
  const canReadPurchaseOrders = hasPermission(
    principal.role,
    "purchase_order.read",
  );
  const canReadProduction = hasPermission(
    principal.role,
    "production.order.read",
  );
  const canReadSales = hasPermission(principal.role, "sales.read");
  const canReadDistribution = hasPermission(
    principal.role,
    "distribution.read",
  );

  if (
    !canReadInventory &&
    !canReadSuppliers &&
    !canReadPurchaseOrders &&
    !canReadProduction &&
    !canReadSales &&
    !canReadDistribution
  ) {
    redirect("/forbidden");
  }

  const [
    inventoryTotals,
    lowStockCount,
    outOfStockCount,
    availableCount,
    supplierCount,
    activeSupplierCount,
    purchaseOrderGroups,
    productionOrderGroups,
    customerCount,
    customerOrderGroups,
    shipmentGroups,
  ] = await Promise.all([
    canReadInventory
      ? prisma.product.aggregate({
          _count: { _all: true },
          _sum: { quantity: true },
        })
      : Promise.resolve(null),
    canReadInventory
      ? prisma.product.count({ where: inventoryStatusWhere("low") })
      : Promise.resolve(null),
    canReadInventory
      ? prisma.product.count({ where: inventoryStatusWhere("out") })
      : Promise.resolve(null),
    canReadInventory
      ? prisma.product.count({ where: inventoryStatusWhere("normal") })
      : Promise.resolve(null),
    canReadSuppliers ? prisma.supplier.count() : Promise.resolve(null),
    canReadSuppliers
      ? prisma.supplier.count({ where: { isActive: true } })
      : Promise.resolve(null),
    canReadPurchaseOrders
      ? prisma.purchaseOrder.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve(null),
    canReadProduction
      ? prisma.productionOrder.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve(null),
    canReadSales ? prisma.customer.count() : Promise.resolve(null),
    canReadSales
      ? prisma.customerOrder.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve(null),
    canReadDistribution
      ? prisma.deliveryShipment.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve(null),
  ]);

  const analyticsWhere = periodStart ? { createdAt: { gte: periodStart } } : {};
  const [
      inventoryTrendRows,
      procurementTrendRows,
      procurementAnalyticsStatuses,
      productionTrendRows,
      productionAnalyticsStatuses,
      salesTrendRows,
      salesAnalyticsStatuses,
      distributionTrendRows,
      distributionAnalyticsStatuses,
  ] = await Promise.all([
      canReadInventory
        ? prisma.$queryRaw<AnalyticsTrendRow[]>`
            SELECT
              date_trunc(${bucketSize}, "createdAt") AS bucket,
              COALESCE(SUM("quantity") FILTER (WHERE "type" = 'IN'), 0)::float8 AS inbound,
              COALESCE(SUM("quantity") FILTER (WHERE "type" = 'OUT'), 0)::float8 AS outbound
            FROM "StockMovement"
            WHERE (${periodStart}::timestamptz IS NULL OR "createdAt" >= ${periodStart})
            GROUP BY bucket
            ORDER BY bucket ASC
          `
        : Promise.resolve([] as AnalyticsTrendRow[]),
      canReadPurchaseOrders
        ? prisma.$queryRaw<AnalyticsTrendRow[]>`
            SELECT
              date_trunc(${bucketSize}, event_time) AS bucket,
              COUNT(*) FILTER (WHERE event_type = 'created')::int AS created,
              COUNT(*) FILTER (WHERE event_type = 'received')::int AS received
            FROM (
              SELECT "createdAt" AS event_time, 'created'::text AS event_type
              FROM "PurchaseOrder"
              WHERE (${periodStart}::timestamptz IS NULL OR "createdAt" >= ${periodStart})
              UNION ALL
              SELECT "createdAt" AS event_time, 'received'::text AS event_type
              FROM "PurchaseOrderReceipt"
              WHERE (${periodStart}::timestamptz IS NULL OR "createdAt" >= ${periodStart})
            ) AS procurement_events
            GROUP BY bucket
            ORDER BY bucket ASC
          `
        : Promise.resolve([] as AnalyticsTrendRow[]),
      canReadPurchaseOrders
        ? prisma.purchaseOrder.groupBy({
            by: ["status"],
            where: analyticsWhere,
            _count: { _all: true },
          })
        : Promise.resolve(null),
      canReadProduction
        ? prisma.$queryRaw<AnalyticsTrendRow[]>`
            SELECT
              date_trunc(${bucketSize}, event_time) AS bucket,
              COUNT(*) FILTER (WHERE event_type = 'created')::int AS created,
              COUNT(*) FILTER (WHERE event_type = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE event_type = 'cancelled')::int AS cancelled
            FROM (
              SELECT "createdAt" AS event_time, 'created'::text AS event_type
              FROM "ProductionOrder"
              WHERE (${periodStart}::timestamptz IS NULL OR "createdAt" >= ${periodStart})
              UNION ALL
              SELECT "completedAt", 'completed'::text
              FROM "ProductionOrder"
              WHERE "completedAt" IS NOT NULL
                AND (${periodStart}::timestamptz IS NULL OR "completedAt" >= ${periodStart})
              UNION ALL
              SELECT "cancelledAt", 'cancelled'::text
              FROM "ProductionOrder"
              WHERE "cancelledAt" IS NOT NULL
                AND (${periodStart}::timestamptz IS NULL OR "cancelledAt" >= ${periodStart})
            ) AS production_events
            GROUP BY bucket
            ORDER BY bucket ASC
          `
        : Promise.resolve([] as AnalyticsTrendRow[]),
      canReadProduction
        ? prisma.productionOrder.groupBy({
            by: ["status"],
            where: analyticsWhere,
            _count: { _all: true },
          })
        : Promise.resolve(null),
      canReadSales
        ? prisma.$queryRaw<AnalyticsTrendRow[]>`
            SELECT
              date_trunc(${bucketSize}, event_time) AS bucket,
              COUNT(*) FILTER (WHERE event_type = 'created')::int AS created,
              COUNT(*) FILTER (WHERE event_type = 'fulfilled')::int AS fulfilled
            FROM (
              SELECT "createdAt" AS event_time, 'created'::text AS event_type
              FROM "CustomerOrder"
              WHERE (${periodStart}::timestamptz IS NULL OR "createdAt" >= ${periodStart})
              UNION ALL
              SELECT "fulfilledAt", 'fulfilled'::text
              FROM "CustomerOrder"
              WHERE "fulfilledAt" IS NOT NULL
                AND (${periodStart}::timestamptz IS NULL OR "fulfilledAt" >= ${periodStart})
            ) AS sales_events
            GROUP BY bucket
            ORDER BY bucket ASC
          `
        : Promise.resolve([] as AnalyticsTrendRow[]),
      canReadSales
        ? prisma.customerOrder.groupBy({
            by: ["status"],
            where: analyticsWhere,
            _count: { _all: true },
          })
        : Promise.resolve(null),
      canReadDistribution
        ? prisma.$queryRaw<AnalyticsTrendRow[]>`
            SELECT
              date_trunc(${bucketSize}, event_time) AS bucket,
              COUNT(*) FILTER (WHERE event_type = 'delivered')::int AS delivered,
              COUNT(*) FILTER (WHERE event_type = 'failed')::int AS failed
            FROM (
              SELECT "deliveredAt" AS event_time, 'delivered'::text AS event_type
              FROM "DeliveryShipment"
              WHERE "deliveredAt" IS NOT NULL
                AND (${periodStart}::timestamptz IS NULL OR "deliveredAt" >= ${periodStart})
              UNION ALL
              SELECT "createdAt", 'failed'::text
              FROM "DeliveryEvent"
              WHERE "type" = 'STATUS_CHANGED' AND "toStatus" = 'DELIVERY_FAILED'
                AND (${periodStart}::timestamptz IS NULL OR "createdAt" >= ${periodStart})
            ) AS delivery_events
            GROUP BY bucket
            ORDER BY bucket ASC
          `
        : Promise.resolve([] as AnalyticsTrendRow[]),
      canReadDistribution
        ? prisma.deliveryShipment.groupBy({
            by: ["status"],
            where: analyticsWhere,
            _count: { _all: true },
          })
        : Promise.resolve(null),
  ]);

  const [
      recentPurchaseOrders,
    recentReceipts,
    recentMovements,
    recentProductionOrders,
    recentCustomerOrders,
    recentDeliveryEvents,
    recentDispatchedRuns,
  ] = await Promise.all([
    canReadPurchaseOrders
      ? prisma.purchaseOrder.findMany({
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            submittedAt: true,
            cancelledAt: true,
            supplier: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    canReadPurchaseOrders
      ? prisma.purchaseOrderReceipt.findMany({
          select: {
            id: true,
            createdAt: true,
            purchaseOrder: {
              select: { id: true, orderNumber: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    canReadInventory
      ? prisma.stockMovement.findMany({
          select: {
            id: true,
            type: true,
            quantity: true,
            createdAt: true,
            product: { select: { name: true, sku: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    canReadProduction
      ? prisma.productionOrder.findMany({
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            cancelledAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    canReadSales
      ? prisma.customerOrder.findMany({
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            createdAt: true,
            confirmedAt: true,
            fulfilledAt: true,
            cancelledAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    canReadDistribution
      ? prisma.deliveryEvent.findMany({
          where: {
            type: { in: ["CREATED", "STATUS_CHANGED", "RESCHEDULED"] },
          },
          select: {
            id: true,
            type: true,
            toStatus: true,
            createdAt: true,
            shipment: {
              select: { id: true, reference: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    canReadDistribution
      ? prisma.deliveryRun.findMany({
          where: { dispatchedAt: { not: null } },
          select: {
            id: true,
            runNumber: true,
            dispatchedAt: true,
          },
          orderBy: { dispatchedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  const analyticsModules: AnalyticsModule[] = [];
  if (canReadInventory) {
    analyticsModules.push({
      key: "inventory",
      title: "حركة المخزون",
      description: "كميات الإدخال والصرف المسجلة حسب الفترة.",
      trendLabel: "حركة المخزون",
      data: formatAnalyticsRows(inventoryTrendRows, bucketSize),
      series: [
        { key: "inbound", label: "دخول", color: "#34d399" },
        { key: "outbound", label: "صرف", color: "#fb7185" },
      ],
      statuses: [],
      chartType: "line",
      href: "/inventory",
    });
  }
  if (canReadPurchaseOrders) {
    analyticsModules.push({
      key: "procurement",
      title: "المشتريات والاستلام",
      description: "أوامر الشراء الجديدة وعمليات الاستلام.",
      trendLabel: "أوامر الشراء والاستلام",
      data: formatAnalyticsRows(procurementTrendRows, bucketSize),
      series: [
        { key: "created", label: "أوامر شراء", color: "#a78bfa" },
        { key: "received", label: "استلامات", color: "#34d399" },
      ],
      statuses: formatAnalyticsStatuses(procurementAnalyticsStatuses, {
        DRAFT: { label: "مسودة", color: "#94a3b8" },
        SUBMITTED: { label: "مرسلة", color: "#60a5fa" },
        PARTIALLY_RECEIVED: { label: "استلام جزئي", color: "#fbbf24" },
        RECEIVED: { label: "مستلمة", color: "#34d399" },
        CANCELLED: { label: "ملغاة", color: "#fb7185" },
      }),
      chartType: "bar",
      href: "/purchase-orders",
    });
  }
  if (canReadProduction) {
    analyticsModules.push({
      key: "production",
      title: "أداء الإنتاج",
      description: "أوامر الإنتاج المنشأة والمكتملة والملغاة.",
      trendLabel: "أوامر الإنتاج",
      data: formatAnalyticsRows(productionTrendRows, bucketSize),
      series: [
        { key: "created", label: "منشأة", color: "#60a5fa" },
        { key: "completed", label: "مكتملة", color: "#34d399" },
        { key: "cancelled", label: "ملغاة", color: "#fb7185" },
      ],
      statuses: formatAnalyticsStatuses(productionAnalyticsStatuses, {
        DRAFT: { label: "مسودة", color: "#94a3b8" },
        IN_PROGRESS: { label: "قيد التنفيذ", color: "#60a5fa" },
        COMPLETED: { label: "مكتملة", color: "#34d399" },
        CANCELLED: { label: "ملغاة", color: "#fb7185" },
      }),
      chartType: "line",
      href: "/production",
    });
  }
  if (canReadSales) {
    analyticsModules.push({
      key: "sales",
      title: "طلبات العملاء",
      description: "الطلبات المنشأة والمنفذة دون مؤشرات مالية.",
      trendLabel: "طلبات العملاء",
      data: formatAnalyticsRows(salesTrendRows, bucketSize),
      series: [
        { key: "created", label: "طلبات منشأة", color: "#818cf8" },
        { key: "fulfilled", label: "طلبات منفذة", color: "#34d399" },
      ],
      statuses: formatAnalyticsStatuses(salesAnalyticsStatuses, {
        DRAFT: { label: "مسودة", color: "#94a3b8" },
        CONFIRMED: { label: "مؤكدة", color: "#60a5fa" },
        FULFILLED: { label: "منفذة", color: "#34d399" },
        CANCELLED: { label: "ملغاة", color: "#fb7185" },
      }),
      chartType: "bar",
      href: "/sales/orders",
    });
  }
  if (canReadDistribution) {
    analyticsModules.push({
      key: "distribution",
      title: "التوزيع والتسليم",
      description: "الشحنات المسلّمة ومحاولات التسليم المتعذرة.",
      trendLabel: "التسليم ومحاولات التوصيل",
      data: formatAnalyticsRows(distributionTrendRows, bucketSize),
      series: [
        { key: "delivered", label: "تم التسليم", color: "#34d399" },
        { key: "failed", label: "محاولات متعذرة", color: "#fb7185" },
      ],
      statuses: formatAnalyticsStatuses(distributionAnalyticsStatuses, {
        PREPARING: { label: "قيد التجهيز", color: "#fbbf24" },
        READY_FOR_DISPATCH: { label: "جاهزة للإرسال", color: "#38bdf8" },
        DISPATCHED: { label: "مرسلة", color: "#818cf8" },
        IN_TRANSIT: { label: "قيد التوصيل", color: "#60a5fa" },
        DELIVERED: { label: "تم التسليم", color: "#34d399" },
        DELIVERY_FAILED: { label: "تعذّر التسليم", color: "#fb7185" },
      }),
      chartType: "bar",
      href: "/distribution/deliveries",
    });
  }

  const sections: {
    title: string;
    description: string;
    icon: LucideIcon;
    metrics: ExecutiveMetric[];
  }[] = [];

  if (canReadInventory && inventoryTotals) {
    sections.push({
      title: "المخزون",
      description: "مستويات الأصناف والكميات المتاحة حاليًا.",
      icon: Boxes,
      metrics: [
        {
          label: "إجمالي المنتجات",
          value: countFormatter.format(inventoryTotals._count._all),
          href: "/inventory",
          icon: Boxes,
          accent: "blue",
        },
        {
          label: "إجمالي وحدات المخزون",
          value: quantityFormatter.format(inventoryTotals._sum.quantity ?? 0),
          href: "/inventory",
          icon: PackageOpen,
          accent: "violet",
        },
        {
          label: "منتجات متوفرة",
          value: countFormatter.format(availableCount ?? 0),
          href: "/inventory?status=normal",
          icon: CheckCircle2,
          accent: "emerald",
        },
        {
          label: "منتجات منخفضة المخزون",
          value: countFormatter.format(lowStockCount ?? 0),
          href: "/inventory?status=low",
          icon: PackageCheck,
          accent: "amber",
        },
        {
          label: "منتجات نفد مخزونها",
          value: countFormatter.format(outOfStockCount ?? 0),
          href: "/inventory?status=out",
          icon: PackageOpen,
          accent: "rose",
        },
      ],
    });
  }

  if (canReadSuppliers || canReadPurchaseOrders) {
    const metrics: ExecutiveMetric[] = [];
    if (canReadSuppliers) {
      metrics.push({
        label: "إجمالي الموردين",
        value: countFormatter.format(supplierCount ?? 0),
        href: "/suppliers",
        icon: Building2,
        accent: "blue",
      });
    }
    if (canReadPurchaseOrders) {
      metrics.push(
        {
          label: "طلبات الشراء",
          value: countFormatter.format(totalCount(purchaseOrderGroups)),
          href: "/purchase-orders",
          icon: ShoppingCart,
          accent: "violet",
        },
        {
          label: "طلبات شراء قيد المعالجة",
          value: countFormatter.format(
            countForStatus(purchaseOrderGroups, "DRAFT") +
              countForStatus(purchaseOrderGroups, "SUBMITTED") +
              countForStatus(purchaseOrderGroups, "PARTIALLY_RECEIVED"),
          ),
          href: "/purchase-orders",
          icon: ClipboardList,
          accent: "amber",
        },
      );
    }
    sections.push({
      title: "المشتريات",
      description: "متابعة الموردين وحالة أوامر الشراء.",
      icon: ShoppingCart,
      metrics,
    });
  }

  if (canReadProduction) {
    sections.push({
      title: "الإنتاج",
      description: "رؤية موجزة لحالة أوامر الإنتاج.",
      icon: Factory,
      metrics: [
        {
          label: "أوامر الإنتاج",
          value: countFormatter.format(totalCount(productionOrderGroups)),
          href: "/production",
          icon: Factory,
          accent: "blue",
        },
        {
          label: "أوامر قيد التنفيذ",
          value: countFormatter.format(
            countForStatus(productionOrderGroups, "IN_PROGRESS"),
          ),
          href: "/production",
          icon: PackageOpen,
          accent: "amber",
        },
        {
          label: "أوامر مكتملة",
          value: countFormatter.format(
            countForStatus(productionOrderGroups, "COMPLETED"),
          ),
          href: "/production",
          icon: CheckCircle2,
          accent: "emerald",
        },
      ],
    });
  }

  if (canReadSales) {
    sections.push({
      title: "المبيعات",
      description: "متابعة العملاء وطلبات البيع المفتوحة.",
      icon: ShoppingBag,
      metrics: [
        {
          label: "إجمالي العملاء",
          value: countFormatter.format(customerCount ?? 0),
          href: "/sales/customers",
          icon: UsersRound,
          accent: "blue",
        },
        {
          label: "طلبات العملاء",
          value: countFormatter.format(totalCount(customerOrderGroups)),
          href: "/sales/orders",
          icon: ShoppingBag,
          accent: "violet",
        },
        {
          label: "طلبات بانتظار التنفيذ",
          value: countFormatter.format(
            countForStatus(customerOrderGroups, "CONFIRMED"),
          ),
          href: "/sales/orders",
          icon: ClipboardList,
          accent: "amber",
        },
      ],
    });
  }

  if (canReadDistribution) {
    sections.push({
      title: "التوزيع",
      description: "حالة الشحنات الجاهزة للتوزيع والتسليم.",
      icon: Truck,
      metrics: [
        {
          label: "إجمالي الشحنات",
          value: countFormatter.format(totalCount(shipmentGroups)),
          href: "/distribution/deliveries",
          icon: Truck,
          accent: "blue",
        },
        {
          label: "شحنات بانتظار الإرسال",
          value: countFormatter.format(
            countForStatus(shipmentGroups, "READY_FOR_DISPATCH"),
          ),
          href: "/distribution/deliveries",
          icon: PackageOpen,
          accent: "amber",
        },
        {
          label: "شحنات تم تسليمها",
          value: countFormatter.format(
            countForStatus(shipmentGroups, "DELIVERED"),
          ),
          href: "/distribution/deliveries",
          icon: CheckCircle2,
          accent: "emerald",
        },
      ],
    });
  }

  const stageMetrics = createSupplyChainStageMetrics({
    count: (value) => countFormatter.format(value),
    canReadSuppliers,
    supplierCount,
    activeSupplierCount,
    canReadPurchaseOrders,
    purchaseOrderCount: totalCount(purchaseOrderGroups),
    pendingPurchaseOrderCount:
      countForStatus(purchaseOrderGroups, "DRAFT") +
      countForStatus(purchaseOrderGroups, "SUBMITTED") +
      countForStatus(purchaseOrderGroups, "PARTIALLY_RECEIVED"),
    canReadInventory,
    productCount: inventoryTotals?._count._all ?? null,
    lowStockCount,
    availableCount,
    canReadProduction,
    productionOrderCount: totalCount(productionOrderGroups),
    inProgressProductionCount: countForStatus(
      productionOrderGroups,
      "IN_PROGRESS",
    ),
    completedProductionCount: countForStatus(
      productionOrderGroups,
      "COMPLETED",
    ),
    canReadSales,
    customerOrderCount: totalCount(customerOrderGroups),
    confirmedCustomerOrderCount: countForStatus(
      customerOrderGroups,
      "CONFIRMED",
    ),
    canReadDistribution,
    readyForDispatchCount: countForStatus(
      shipmentGroups,
      "READY_FOR_DISPATCH",
    ),
    inTransitShipmentCount: countForStatus(shipmentGroups, "IN_TRANSIT"),
    deliveredShipmentCount: countForStatus(shipmentGroups, "DELIVERED"),
  });

  const alerts: OperationalAlert[] = [];

  if (canReadInventory) {
    alerts.push(
      {
        title: "منتجات نفد مخزونها",
        description: "تحقق من توافر هذه المنتجات وخطط لإعادة التزويد.",
        category: "المخزون",
        count: outOfStockCount ?? 0,
        href: "/inventory?status=out",
        severity: "critical",
      },
      {
        title: "منتجات بمخزون منخفض",
        description: "مستوى هذه المنتجات عند حد إعادة الطلب أو دونه.",
        category: "المخزون",
        count: lowStockCount ?? 0,
        href: "/inventory?status=low",
        severity: "warning",
      },
    );
  }

  if (canReadPurchaseOrders) {
    alerts.push(
      {
        title: "طلبات شراء بانتظار الإجراء",
        description: "طلبات الشراء المسجلة كمسودات ولم تُرسل بعد.",
        category: "المشتريات",
        count: countForStatus(purchaseOrderGroups, "DRAFT"),
        href: "/purchase-orders",
        severity: "information",
      },
      {
        title: "طلبات شراء بانتظار الاستلام",
        description: "طلبات مرسلة أو مستلمة جزئيًا وتحتاج إلى متابعة الاستلام.",
        category: "المشتريات",
        count:
          countForStatus(purchaseOrderGroups, "SUBMITTED") +
          countForStatus(purchaseOrderGroups, "PARTIALLY_RECEIVED"),
        href: "/purchase-orders",
        severity: "warning",
      },
    );
  }

  if (canReadProduction) {
    alerts.push(
      {
        title: "أوامر إنتاج بانتظار البدء",
        description: "أوامر إنتاج بحالة مسودة تنتظر بدء الإجراء.",
        category: "الإنتاج",
        count: countForStatus(productionOrderGroups, "DRAFT"),
        href: "/production",
        severity: "information",
      },
      {
        title: "أوامر إنتاج قيد التنفيذ",
        description: "أوامر الإنتاج النشطة حاليًا.",
        category: "الإنتاج",
        count: countForStatus(productionOrderGroups, "IN_PROGRESS"),
        href: "/production",
        severity: "information",
      },
    );
  }

  if (canReadSales) {
    alerts.push(
      {
        title: "طلبات عملاء بانتظار التأكيد",
        description: "طلبات مسجلة كمسودات وتنتظر مراجعة فريق المبيعات.",
        category: "المبيعات",
        count: countForStatus(customerOrderGroups, "DRAFT"),
        href: "/sales/orders",
        severity: "information",
      },
      {
        title: "طلبات مؤكدة بانتظار التنفيذ",
        description: "طلبات العملاء المؤكدة ولم تُستكمل بعد.",
        category: "المبيعات",
        count: countForStatus(customerOrderGroups, "CONFIRMED"),
        href: "/sales/orders",
        severity: "warning",
      },
    );
  }

  if (canReadDistribution) {
    alerts.push(
      {
        title: "شحنات جاهزة بانتظار الإرسال",
        description: "شحنات جاهزة ولم يبدأ إرسالها بعد.",
        category: "التوزيع",
        count: countForStatus(shipmentGroups, "READY_FOR_DISPATCH"),
        href: "/distribution/deliveries",
        severity: "warning",
      },
      {
        title: "شحنات قيد التوصيل",
        description: "شحنات أُرسلت وما زالت في مرحلة التوصيل.",
        category: "التوزيع",
        count: countForStatus(shipmentGroups, "IN_TRANSIT"),
        href: "/distribution/deliveries",
        severity: "information",
      },
      {
        title: "محاولات توصيل متعذرة",
        description: "راجع الشحنات التي تعذّر تسليمها لمتابعة الإجراء المناسب.",
        category: "التوزيع",
        count: countForStatus(shipmentGroups, "DELIVERY_FAILED"),
        href: "/distribution/deliveries",
        severity: "warning",
      },
    );
  }

  const activities: TimelineActivity[] = [];
  const addActivity = (
    activity: TimelineActivity,
  ) => activities.push(activity);

  for (const order of recentPurchaseOrders) {
    addActivity({
      id: `purchase-created-${order.id}`,
      title: "إنشاء أمر شراء",
      description: `تم تسجيل أمر شراء للمورد ${order.supplier.name}.`,
      category: "المشتريات",
      reference: order.orderNumber,
      occurredAt: order.createdAt,
      href: `/purchase-orders/${order.id}`,
    });
    if (order.submittedAt) {
      addActivity({
        id: `purchase-submitted-${order.id}`,
        title: "إرسال أمر شراء",
        description: "تم إرسال أمر الشراء إلى المورد.",
        category: "المشتريات",
        reference: order.orderNumber,
        occurredAt: order.submittedAt,
        href: `/purchase-orders/${order.id}`,
      });
    }
    if (order.cancelledAt) {
      addActivity({
        id: `purchase-cancelled-${order.id}`,
        title: "إلغاء أمر شراء",
        description: "تم تسجيل إلغاء أمر الشراء.",
        category: "المشتريات",
        reference: order.orderNumber,
        occurredAt: order.cancelledAt,
        href: `/purchase-orders/${order.id}`,
      });
    }
  }

  for (const receipt of recentReceipts) {
    addActivity({
      id: `purchase-receipt-${receipt.id}`,
      title: "استلام مشتريات",
      description: "تم تسجيل استلام على أمر الشراء.",
      category: "المشتريات",
      reference: receipt.purchaseOrder.orderNumber,
      occurredAt: receipt.createdAt,
      href: `/purchase-orders/${receipt.purchaseOrder.id}`,
    });
  }

  for (const movement of recentMovements) {
    const isInbound = movement.type === "IN";
    addActivity({
      id: `stock-movement-${movement.id}`,
      title: isInbound ? "دخول مخزون" : "صرف من المخزون",
      description: `${activityQuantityFormatter.format(movement.quantity)} ${isInbound ? "وحدة أضيفت إلى" : "وحدة صُرفت من"} ${movement.product.name}.`,
      category: "المخزون",
      reference: movement.product.sku,
      occurredAt: movement.createdAt,
      href: "/inventory",
    });
  }

  for (const order of recentProductionOrders) {
    addActivity({
      id: `production-created-${order.id}`,
      title: "إنشاء أمر إنتاج",
      description: "تم تسجيل أمر إنتاج جديد.",
      category: "الإنتاج",
      reference: order.orderNumber,
      occurredAt: order.createdAt,
      href: `/production/orders/${order.id}`,
    });
    if (order.startedAt) {
      addActivity({
        id: `production-started-${order.id}`,
        title: "بدء أمر إنتاج",
        description: "بدأ تنفيذ أمر الإنتاج.",
        category: "الإنتاج",
        reference: order.orderNumber,
        occurredAt: order.startedAt,
        href: `/production/orders/${order.id}`,
      });
    }
    if (order.completedAt) {
      addActivity({
        id: `production-completed-${order.id}`,
        title: "اكتمال أمر إنتاج",
        description: "تم تسجيل اكتمال أمر الإنتاج.",
        category: "الإنتاج",
        reference: order.orderNumber,
        occurredAt: order.completedAt,
        href: `/production/orders/${order.id}`,
      });
    }
    if (order.cancelledAt) {
      addActivity({
        id: `production-cancelled-${order.id}`,
        title: "إلغاء أمر إنتاج",
        description: "تم تسجيل إلغاء أمر الإنتاج.",
        category: "الإنتاج",
        reference: order.orderNumber,
        occurredAt: order.cancelledAt,
        href: `/production/orders/${order.id}`,
      });
    }
  }

  for (const order of recentCustomerOrders) {
    addActivity({
      id: `customer-order-created-${order.id}`,
      title: "إنشاء طلب عميل",
      description: `تم تسجيل طلب العميل ${order.customerName}.`,
      category: "المبيعات",
      reference: order.orderNumber,
      occurredAt: order.createdAt,
      href: `/sales/orders/${order.id}`,
    });
    if (order.confirmedAt) {
      addActivity({
        id: `customer-order-confirmed-${order.id}`,
        title: "تأكيد طلب عميل",
        description: "تم تأكيد الطلب وحجز المنتجات.",
        category: "المبيعات",
        reference: order.orderNumber,
        occurredAt: order.confirmedAt,
        href: `/sales/orders/${order.id}`,
      });
    }
    if (order.fulfilledAt) {
      addActivity({
        id: `customer-order-fulfilled-${order.id}`,
        title: "تنفيذ طلب عميل",
        description: "تم تسجيل اكتمال تنفيذ الطلب.",
        category: "المبيعات",
        reference: order.orderNumber,
        occurredAt: order.fulfilledAt,
        href: `/sales/orders/${order.id}`,
      });
    }
    if (order.cancelledAt) {
      addActivity({
        id: `customer-order-cancelled-${order.id}`,
        title: "إلغاء طلب عميل",
        description: "تم تسجيل إلغاء طلب العميل.",
        category: "المبيعات",
        reference: order.orderNumber,
        occurredAt: order.cancelledAt,
        href: `/sales/orders/${order.id}`,
      });
    }
  }

  for (const event of recentDeliveryEvents) {
    if (event.type === "CREATED") {
      addActivity({
        id: `shipment-created-${event.id}`,
        title: "إنشاء شحنة",
        description: "تم إنشاء شحنة توصيل لطلب عميل.",
        category: "التوزيع",
        reference: event.shipment.reference,
        occurredAt: event.createdAt,
        href: `/distribution/deliveries/${event.shipment.id}`,
      });
      continue;
    }
    if (event.type === "RESCHEDULED") {
      addActivity({
        id: `shipment-rescheduled-${event.id}`,
        title: "إعادة جدولة شحنة",
        description: "تم تحديث موعد التسليم المتوقع.",
        category: "التوزيع",
        reference: event.shipment.reference,
        occurredAt: event.createdAt,
        href: `/distribution/deliveries/${event.shipment.id}`,
      });
      continue;
    }

    const statusDetails: Record<
      string,
      { title: string; description: string }
    > = {
      DISPATCHED: {
        title: "إرسال شحنة",
        description: "بدأت الشحنة مرحلة التوزيع.",
      },
      IN_TRANSIT: {
        title: "بدء توصيل شحنة",
        description: "الشحنة في طريقها إلى العميل.",
      },
      DELIVERED: {
        title: "تسليم شحنة",
        description: "تم تسجيل تسليم الشحنة.",
      },
      DELIVERY_FAILED: {
        title: "محاولة توصيل متعذرة",
        description: "تم تسجيل تعذّر تسليم الشحنة.",
      },
    };
    const statusDetail = event.toStatus
      ? statusDetails[event.toStatus]
      : undefined;
    if (statusDetail) {
      addActivity({
        id: `shipment-status-${event.id}`,
        title: statusDetail.title,
        description: statusDetail.description,
        category: "التوزيع",
        reference: event.shipment.reference,
        occurredAt: event.createdAt,
        href: `/distribution/deliveries/${event.shipment.id}`,
      });
    }
  }

  for (const run of recentDispatchedRuns) {
    if (!run.dispatchedAt) continue;
    addActivity({
      id: `delivery-run-dispatched-${run.id}`,
      title: "إرسال مسار توصيل",
      description: "تم إرسال مسار التوصيل للشحنات المسندة إليه.",
      category: "التوزيع",
      reference: run.runNumber,
      occurredAt: run.dispatchedAt,
      href: `/distribution/runs/${run.id}`,
    });
  }

  activities.sort(
    (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
  );
  const recentActivities = activities.slice(0, 12);
  const activityModuleLinks = [
    canReadPurchaseOrders
      ? { label: "المشتريات", href: "/purchase-orders" }
      : null,
    canReadInventory ? { label: "المخزون", href: "/inventory" } : null,
    canReadProduction ? { label: "الإنتاج", href: "/production" } : null,
    canReadSales ? { label: "المبيعات", href: "/sales/orders" } : null,
    canReadDistribution
      ? { label: "التوزيع", href: "/distribution/deliveries" }
      : null,
  ].filter((link) => link !== null);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-7 p-4 sm:p-6 lg:p-8">
      <section className="relative isolate overflow-hidden rounded-2xl border border-sky-300/[0.12] bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 px-5 py-6 shadow-xl shadow-black/15 sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute -end-16 -top-28 -z-10 size-72 rounded-full bg-sky-400/[0.07] blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-2.5 text-[11px] font-semibold tracking-[0.16em] text-sky-300">
              لوحة الإدارة التنفيذية
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
              مرحبًا بك في ImdadDZ
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-6 text-slate-400">
              نظرة واضحة على مؤشرات العمليات عبر وحدات سلسلة التوريد.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            مؤشرات مباشرة من قاعدة البيانات
          </div>
        </div>
      </section>

      <SupplyChainOverview
        stageMetrics={stageMetrics}
        stageAccess={{
          suppliers: canReadSuppliers,
          purchaseOrders: canReadPurchaseOrders,
          inventory: canReadInventory,
          production: canReadProduction,
          sales: canReadSales,
          distribution: canReadDistribution,
        }}
      />

      <div className="space-y-7">
        {sections.map(({ title, description, icon: Icon, metrics }) => (
          <section key={title} aria-label={`مؤشرات ${title}`} className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-slate-900/80 text-sky-300">
                <Icon aria-hidden="true" className="size-[17px]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-[13px]">
                  {description}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {metrics.map((metric) => (
                <ExecutiveMetricCard key={metric.label} {...metric} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <AlertsCenter alerts={alerts} />

      <RecentActivityTimeline
        activities={recentActivities}
        moduleLinks={activityModuleLinks}
      />

      <AnalyticsSection
        period={period}
        modules={analyticsModules}
        inventorySummary={
          canReadInventory
            ? {
                lowStock: lowStockCount ?? 0,
                outOfStock: outOfStockCount ?? 0,
                available: availableCount ?? 0,
              }
            : null
        }
      />
    </main>
  );
}

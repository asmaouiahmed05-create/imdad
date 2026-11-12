import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Factory,
  ShoppingBag,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";

type MetricTone = "neutral" | "attention" | "positive";

export type SupplyChainStage = {
  title: string;
  href: string | null;
  icon: LucideIcon;
  accent: "sky" | "violet" | "amber" | "emerald" | "blue" | "indigo";
  metrics: {
    label: string;
    value: string;
    tone?: MetricTone;
  }[];
};

const stages = [
  {
    title: "الموردون",
    icon: Building2,
    accent: "sky",
    href: "/suppliers",
    accessKey: "suppliers",
  },
  {
    title: "المشتريات",
    icon: ShoppingCart,
    accent: "violet",
    href: "/purchase-orders",
    accessKey: "purchaseOrders",
  },
  {
    title: "المخزون",
    icon: Boxes,
    accent: "amber",
    href: "/inventory",
    accessKey: "inventory",
  },
  {
    title: "الإنتاج",
    icon: Factory,
    accent: "blue",
    href: "/production",
    accessKey: "production",
  },
  {
    title: "المبيعات",
    icon: ShoppingBag,
    accent: "indigo",
    href: "/sales/orders",
    accessKey: "sales",
  },
  {
    title: "التوزيع والتوصيل",
    icon: Truck,
    accent: "emerald",
    href: "/distribution/deliveries",
    accessKey: "distribution",
  },
] as const;

const accentClasses: Record<SupplyChainStage["accent"], string> = {
  sky: "border-sky-400/20 bg-sky-400/[0.07] text-sky-300",
  violet: "border-violet-400/20 bg-violet-400/[0.07] text-violet-300",
  amber: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
  blue: "border-blue-400/20 bg-blue-400/[0.07] text-blue-300",
  indigo: "border-indigo-400/20 bg-indigo-400/[0.07] text-indigo-300",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
};

const metricToneClasses: Record<MetricTone, string> = {
  neutral: "text-slate-100",
  attention: "text-amber-300",
  positive: "text-emerald-300",
};

export function SupplyChainOverview({
  stageMetrics,
  stageAccess,
}: {
  stageMetrics: Record<string, SupplyChainStage["metrics"]>;
  stageAccess: Record<
    (typeof stages)[number]["accessKey"],
    boolean
  >;
}) {
  return (
    <section
      aria-labelledby="supply-chain-overview-title"
      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/65 p-4 shadow-lg shadow-black/10 sm:p-5"
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-sky-300">
            END-TO-END OPERATIONS
          </p>
          <h2
            id="supply-chain-overview-title"
            className="text-base font-semibold text-white sm:text-lg"
          >
            نظرة عامة على سلسلة التوريد
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:text-sm">
            تدفّق العمليات ومؤشرات موجزة من كل مرحلة.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-slate-500">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          بيانات تشغيلية مباشرة
        </div>
      </header>

      <ol className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-2 pt-1 lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible">
        {stages.map(({ title, icon: Icon, accent, href: stageHref, accessKey }, index) => {
          const href = stageAccess[accessKey] ? stageHref : null;
          const metrics = stageMetrics[title] ?? [];
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid size-10 place-items-center rounded-xl border ${accentClasses[accent]}`}
                >
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <span className="rounded-full border border-white/[0.07] bg-slate-950/70 px-2 py-1 text-[10px] font-medium tabular-nums text-slate-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 text-sm font-semibold text-white">{title}</h3>
              <div className="mt-4 space-y-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex items-baseline justify-between gap-2 border-t border-white/[0.05] pt-2.5"
                  >
                    <span className="text-[11px] leading-4 text-slate-500">
                      {metric.label}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${metricToneClasses[metric.tone ?? "neutral"]}`}
                    >
                      {metric.value}
                    </span>
                  </div>
                ))}
                {metrics.length === 0 && (
                  <p className="border-t border-white/[0.05] pt-2.5 text-[11px] text-slate-500">
                    لا تتوفر صلاحية العرض
                  </p>
                )}
              </div>
              <span className="pointer-events-none absolute -bottom-12 -end-10 size-28 rounded-full bg-white/[0.015] blur-2xl transition group-hover:bg-white/[0.04]" />
            </>
          );
          const cardClassName =
            "group relative block min-h-44 w-[min(76vw,14rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/40 p-3.5 transition duration-200 hover:border-white/[0.16] hover:bg-slate-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 lg:w-auto lg:p-3";

          return (
            <li key={title} className="relative">
              {href ? (
                <Link
                  href={href}
                  aria-label={`فتح وحدة ${title}`}
                  className={cardClassName}
                >
                  {content}
                </Link>
              ) : (
                <div aria-disabled="true" className={cardClassName}>
                  {content}
                </div>
              )}
              {index < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.35rem] top-8 z-10 grid size-6 place-items-center rounded-full border border-white/[0.08] bg-slate-900 text-slate-500 lg:-left-3.5"
                >
                  <ArrowLeft className="size-3.5" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function createSupplyChainStageMetrics(input: {
  count: (value: number) => string;
  canReadSuppliers: boolean;
  supplierCount: number | null;
  activeSupplierCount: number | null;
  canReadPurchaseOrders: boolean;
  purchaseOrderCount: number | null;
  pendingPurchaseOrderCount: number | null;
  canReadInventory: boolean;
  productCount: number | null;
  lowStockCount: number | null;
  availableCount: number | null;
  canReadProduction: boolean;
  productionOrderCount: number | null;
  inProgressProductionCount: number | null;
  completedProductionCount: number | null;
  canReadSales: boolean;
  customerOrderCount: number | null;
  confirmedCustomerOrderCount: number | null;
  canReadDistribution: boolean;
  readyForDispatchCount: number | null;
  inTransitShipmentCount: number | null;
  deliveredShipmentCount: number | null;
}) {
  const {
    count,
    canReadSuppliers,
    supplierCount,
    activeSupplierCount,
    canReadPurchaseOrders,
    purchaseOrderCount,
    pendingPurchaseOrderCount,
    canReadInventory,
    productCount,
    lowStockCount,
    availableCount,
    canReadProduction,
    productionOrderCount,
    inProgressProductionCount,
    completedProductionCount,
    canReadSales,
    customerOrderCount,
    confirmedCustomerOrderCount,
    canReadDistribution,
    readyForDispatchCount,
    inTransitShipmentCount,
    deliveredShipmentCount,
  } = input;

  return {
    الموردون: canReadSuppliers
      ? [
          { label: "إجمالي الموردين", value: count(supplierCount ?? 0) },
          {
            label: "موردون نشطون",
            value: count(activeSupplierCount ?? 0),
            tone: "positive" as const,
          },
        ]
      : [],
    المشتريات: canReadPurchaseOrders
      ? [
          { label: "طلبات الشراء", value: count(purchaseOrderCount ?? 0) },
          {
            label: "طلبات قيد المعالجة",
            value: count(pendingPurchaseOrderCount ?? 0),
            tone: "attention" as const,
          },
        ]
      : [],
    المخزون: canReadInventory
      ? [
          { label: "المنتجات", value: count(productCount ?? 0) },
          {
            label: "متوفرة",
            value: count(availableCount ?? 0),
            tone: "positive" as const,
          },
          {
            label: "مخزون منخفض",
            value: count(lowStockCount ?? 0),
            tone: "attention" as const,
          },
        ]
      : [],
    الإنتاج: canReadProduction
      ? [
          { label: "أوامر الإنتاج", value: count(productionOrderCount ?? 0) },
          {
            label: "قيد التنفيذ",
            value: count(inProgressProductionCount ?? 0),
            tone: "attention" as const,
          },
          {
            label: "مكتملة",
            value: count(completedProductionCount ?? 0),
            tone: "positive" as const,
          },
        ]
      : [],
    المبيعات: canReadSales
      ? [
          { label: "طلبات العملاء", value: count(customerOrderCount ?? 0) },
          {
            label: "بانتظار التنفيذ",
            value: count(confirmedCustomerOrderCount ?? 0),
            tone: "attention" as const,
          },
        ]
      : [],
    "التوزيع والتوصيل": canReadDistribution
      ? [
          {
            label: "بانتظار الإرسال",
            value: count(readyForDispatchCount ?? 0),
            tone: "attention" as const,
          },
          {
            label: "قيد التوصيل",
            value: count(inTransitShipmentCount ?? 0),
          },
          {
            label: "تم التسليم",
            value: count(deliveredShipmentCount ?? 0),
            tone: "positive" as const,
          },
        ]
      : [],
  };
}

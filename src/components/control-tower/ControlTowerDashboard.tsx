"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ClipboardList,
  Factory,
  PackageCheck,
  ShoppingBag,
  Truck,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/PurchaseOrderStatusBadge";
import { useDistributionDemo } from "@/components/distribution/DistributionDemoProvider";
import { useProductionDemo } from "@/components/production/ProductionDemoProvider";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DELIVERY_STATUS_CLASSES,
  DELIVERY_STATUS_LABELS,
} from "@/lib/delivery-demo";
import {
  PRODUCTION_STATUS_CLASSES,
  PRODUCTION_STATUS_LABELS,
} from "@/lib/production-demo";
import {
  SALES_STATUS_CLASSES,
  SALES_STATUS_LABELS,
} from "@/lib/sales-demo";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";

type TowerData = {
  inventory: {
    productCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowStockProducts: Array<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      minQuantity: number;
      unit: string;
    }>;
  };
  procurement: {
    supplierCount: number;
    activeSupplierCount: number;
    purchaseOrderCounts: Record<PurchaseOrderStatus, number>;
    recentPurchaseOrders: Array<{
      id: string;
      orderNumber: string;
      status: PurchaseOrderStatus;
      createdAt: Date;
      supplier: { name: string };
    }>;
  };
};

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

function SourceLabel({ demo = false }: { demo?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        demo
          ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-200"
          : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"
      }
    >
      {demo ? "عرض محلي تجريبي" : "بيانات النظام"}
    </Badge>
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
  demo = false,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  demo?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
        <div className="mt-2">
          <SourceLabel demo={demo} />
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
      >
        {linkLabel}
        <ArrowLeft aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

function DashboardPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75 ${className}`}
    >
      {children}
    </section>
  );
}

export function ControlTowerDashboard({ data }: { data: TowerData }) {
  const { orders: productionOrders, ready: productionReady, error: productionError } =
    useProductionDemo();
  const { orders: salesOrders, ready: salesReady, error: salesError } =
    useSalesDemo();
  const {
    deliveries,
    ready: deliveriesReady,
    error: deliveriesError,
  } = useDistributionDemo();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
  }).format(new Date());
  const activePurchaseOrders =
    data.procurement.purchaseOrderCounts.SUBMITTED +
    data.procurement.purchaseOrderCounts.PARTIALLY_RECEIVED;
  const activeProductionCount = productionOrders.filter(
    (order) => order.status === "PLANNED" || order.status === "IN_PROGRESS",
  ).length;
  const activeSalesCount = salesOrders.filter(
    (order) =>
      order.status !== "DELIVERED" && order.status !== "CANCELLED",
  ).length;
  const activeDeliveryCount = deliveries.filter(
    (delivery) =>
      delivery.status === "PENDING" ||
      delivery.status === "PREPARING" ||
      delivery.status === "OUT_FOR_DELIVERY",
  ).length;
  const delayedDeliveries = deliveries.filter(
    (delivery) =>
      delivery.deliveryDate < today &&
      (delivery.status === "PENDING" ||
        delivery.status === "PREPARING" ||
        delivery.status === "OUT_FOR_DELIVERY"),
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            نظرة تنفيذية موحّدة
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            برج مراقبة سلسلة التوريد
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            متابعة المشتريات والمخزون والإنتاج وطلبات العملاء والتوصيل من لوحة
            واحدة، مع توضيح مصدر كل مجموعة بيانات.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SourceLabel />
          <SourceLabel demo />
        </div>
      </section>

      <section
        aria-label="المؤشرات التشغيلية"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6"
      >
        <StatCard
          label="أوامر شراء قيد التوريد · نظام"
          value={numberFormatter.format(activePurchaseOrders)}
          icon={ClipboardList}
          accent="blue"
        />
        <StatCard
          label="أصناف منخفضة المخزون · نظام"
          value={numberFormatter.format(data.inventory.lowStockCount)}
          icon={AlertTriangle}
          accent="violet"
        />
        <StatCard
          label="أوامر إنتاج نشطة · تجريبي"
          value={
            productionReady ? numberFormatter.format(activeProductionCount) : "—"
          }
          icon={Factory}
          accent="amber"
        />
        <StatCard
          label="طلبات عملاء مفتوحة · تجريبي"
          value={salesReady ? numberFormatter.format(activeSalesCount) : "—"}
          icon={ShoppingBag}
          accent="blue"
        />
        <StatCard
          label="عمليات توصيل نشطة · تجريبي"
          value={
            deliveriesReady ? numberFormatter.format(activeDeliveryCount) : "—"
          }
          icon={Truck}
          accent="violet"
        />
        <StatCard
          label="توصيلات متأخرة · تجريبي"
          value={
            deliveriesReady
              ? numberFormatter.format(delayedDeliveries.length)
              : "—"
          }
          icon={PackageCheck}
          accent="rose"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel>
          <SectionHeading
            title="المشتريات والموردون"
            subtitle="أوامر الشراء وحالة التوريد والموردون المسجلون."
            href="/purchase-orders"
            linkLabel="أوامر الشراء"
          />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <p className="text-xs text-slate-400">إجمالي أوامر الشراء</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {numberFormatter.format(
                  Object.values(data.procurement.purchaseOrderCounts).reduce(
                    (total, count) => total + count,
                    0,
                  ),
                )}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <p className="text-xs text-slate-400">قيد التوريد</p>
              <p className="mt-2 text-2xl font-semibold text-sky-300">
                {numberFormatter.format(activePurchaseOrders)}
              </p>
            </div>
            <Link
              href="/suppliers"
              className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 transition hover:border-sky-400/20"
            >
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <UsersRound aria-hidden="true" className="size-4" />
                الموردون النشطون
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {numberFormatter.format(data.procurement.activeSupplierCount)}
                <span className="ms-1 text-xs font-normal text-slate-500">
                  / {numberFormatter.format(data.procurement.supplierCount)}
                </span>
              </p>
            </Link>
          </div>
          {data.procurement.recentPurchaseOrders.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">
              لا توجد أوامر شراء مسجلة.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {data.procurement.recentPurchaseOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <Link
                      href={`/purchase-orders/${order.id}`}
                      className="font-mono text-xs text-sky-300 hover:underline"
                      dir="ltr"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-sm text-slate-300">
                      {order.supplier.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {dateFormatter.format(order.createdAt)}
                    </span>
                    <PurchaseOrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeading
            title="المخزون وتنبيهات النقص"
            subtitle="كميات الأصناف وحدود إعادة الطلب المسجلة في النظام."
            href="/?status=low"
            linkLabel="إدارة المخزون"
          />
          <div className="grid grid-cols-3 gap-3 p-4">
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-3 sm:p-4">
              <p className="text-xs text-slate-400">الأصناف</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {numberFormatter.format(data.inventory.productCount)}
              </p>
            </div>
            <Link
              href="/?status=low"
              className="rounded-xl border border-violet-400/10 bg-violet-400/[0.04] p-3 transition hover:border-violet-400/30 sm:p-4"
            >
              <p className="text-xs text-violet-200">مخزون منخفض</p>
              <p className="mt-2 text-xl font-semibold text-violet-200">
                {numberFormatter.format(data.inventory.lowStockCount)}
              </p>
            </Link>
            <Link
              href="/?status=out"
              className="rounded-xl border border-rose-400/10 bg-rose-400/[0.04] p-3 transition hover:border-rose-400/30 sm:p-4"
            >
              <p className="text-xs text-rose-200">نفد المخزون</p>
              <p className="mt-2 text-xl font-semibold text-rose-200">
                {numberFormatter.format(data.inventory.outOfStockCount)}
              </p>
            </Link>
          </div>
          {data.inventory.lowStockProducts.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">
              لا توجد أصناف منخفضة أو نافدة المخزون.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {data.inventory.lowStockProducts.map((product) => {
                const outOfStock = product.quantity === 0;
                return (
                  <Link
                    key={product.id}
                    href={`/?q=${encodeURIComponent(product.sku)}&status=${outOfStock ? "out" : "low"}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Boxes
                        aria-hidden="true"
                        className={`size-4 shrink-0 ${outOfStock ? "text-rose-300" : "text-violet-300"}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {product.name}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500" dir="ltr">
                          {product.sku}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p
                        className={`text-sm font-semibold ${outOfStock ? "text-rose-300" : "text-violet-300"}`}
                      >
                        {numberFormatter.format(product.quantity)}{" "}
                        <span className="font-normal">{product.unit}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        الحد الأدنى {numberFormatter.format(product.minQuantity)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeading
            title="الإنتاج"
            subtitle="حالة أوامر الإنتاج في بيانات العرض المحلية."
            href="/production"
            linkLabel="لوحة الإنتاج"
            demo
          />
          {productionError && (
            <p role="alert" className="m-4 text-sm text-rose-300">
              {productionError}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3 p-4">
            {(
              [
                ["PLANNED", "مخطط"],
                ["IN_PROGRESS", "قيد الإنتاج"],
                ["COMPLETED", "مكتمل"],
              ] as const
            ).map(([status, label]) => (
              <div
                key={status}
                className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-3 sm:p-4"
              >
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {productionReady
                    ? numberFormatter.format(
                        productionOrders.filter(
                          (order) => order.status === status,
                        ).length,
                      )
                    : "—"}
                </p>
              </div>
            ))}
          </div>
          {!productionReady ? (
            <p className="px-5 py-5 text-sm text-slate-400">
              جارٍ تحميل بيانات الإنتاج التجريبية...
            </p>
          ) : productionOrders.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">
              لا توجد أوامر إنتاج في بيانات العرض.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {productionOrders.slice(0, 4).map((order) => (
                <Link
                  key={order.id}
                  href={`/production/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-mono text-xs text-sky-300" dir="ltr">
                      {order.number}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {order.product} · {numberFormatter.format(order.quantity)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={PRODUCTION_STATUS_CLASSES[order.status]}
                  >
                    {PRODUCTION_STATUS_LABELS[order.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeading
            title="طلبات العملاء والمبيعات"
            subtitle="طلبات العملاء وحالاتها من بيانات العرض المحلية."
            href="/sales/orders"
            linkLabel="طلبات العملاء"
            demo
          />
          {salesError && (
            <p role="alert" className="m-4 text-sm text-rose-300">
              {salesError}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3 p-4">
            {(
              [
                ["NEW", "جديد"],
                ["CONFIRMED", "مؤكد"],
                ["PREPARING", "قيد التحضير"],
              ] as const
            ).map(([status, label]) => (
              <div
                key={status}
                className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-3 sm:p-4"
              >
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {salesReady
                    ? numberFormatter.format(
                        salesOrders.filter(
                          (order) => order.status === status,
                        ).length,
                      )
                    : "—"}
                </p>
              </div>
            ))}
          </div>
          {!salesReady ? (
            <p className="px-5 py-5 text-sm text-slate-400">
              جارٍ تحميل طلبات العملاء التجريبية...
            </p>
          ) : salesOrders.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">
              لا توجد طلبات عملاء في بيانات العرض.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {salesOrders.slice(0, 4).map((order) => (
                <Link
                  key={order.id}
                  href={`/sales/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-mono text-xs text-sky-300" dir="ltr">
                      {order.number}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {order.product} · {numberFormatter.format(order.quantity)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={SALES_STATUS_CLASSES[order.status]}
                  >
                    {SALES_STATUS_LABELS[order.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel className="xl:col-span-2">
          <SectionHeading
            title="عمليات التوصيل والتأخير"
            subtitle={`سجلات التوصيل التجريبية المتأخرة تُحسب عند تجاوز التاريخ المحدد دون تسليم (قبل ${today}).`}
            href="/distribution"
            linkLabel="لوحة التوزيع"
            demo
          />
          {deliveriesError && (
            <p role="alert" className="m-4 text-sm text-rose-300">
              {deliveriesError}
            </p>
          )}
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">عمليات نشطة</p>
                <p className="mt-2 text-2xl font-semibold text-sky-300">
                  {deliveriesReady
                    ? numberFormatter.format(activeDeliveryCount)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.04] p-4">
                <p className="text-xs text-rose-200">متأخرة</p>
                <p className="mt-2 text-2xl font-semibold text-rose-200">
                  {deliveriesReady
                    ? numberFormatter.format(delayedDeliveries.length)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">تم التسليم</p>
                <p className="mt-2 text-xl font-semibold text-emerald-300">
                  {deliveriesReady
                    ? numberFormatter.format(
                        deliveries.filter(
                          (delivery) => delivery.status === "DELIVERED",
                        ).length,
                      )
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">تعذّر التسليم</p>
                <p className="mt-2 text-xl font-semibold text-rose-300">
                  {deliveriesReady
                    ? numberFormatter.format(
                        deliveries.filter(
                          (delivery) => delivery.status === "FAILED",
                        ).length,
                      )
                    : "—"}
                </p>
              </div>
            </div>
            {!deliveriesReady ? (
              <p className="self-center text-sm text-slate-400">
                جارٍ تحميل بيانات التوصيل التجريبية...
              </p>
            ) : deliveries.length === 0 ? (
              <p className="self-center text-center text-sm text-slate-400">
                لا توجد سجلات توصيل في بيانات العرض.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-slate-950/40">
                {deliveries.slice(0, 5).map((delivery) => (
                  <Link
                    key={delivery.id}
                    href={`/distribution/deliveries/${delivery.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="font-mono text-xs text-sky-300" dir="ltr">
                        {delivery.reference}
                      </p>
                      <p className="mt-1 text-sm text-slate-400" dir="ltr">
                        {delivery.deliveryDate}
                        {delivery.deliveryDate < today &&
                          delivery.status !== "DELIVERED" &&
                          delivery.status !== "FAILED" && (
                            <span className="ms-2 text-rose-300">
                              متأخر
                            </span>
                          )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={DELIVERY_STATUS_CLASSES[delivery.status]}
                    >
                      {DELIVERY_STATUS_LABELS[delivery.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              عدد الموردين وأوامر الشراء والمخزون من قاعدة بيانات النظام. أما
              الإنتاج وطلبات العملاء والتوصيل فهي بيانات عرض محفوظة محليًا، ولا
              تمثل نتائج تشغيلية فعلية.
            </p>
          </div>
        </DashboardPanel>
      </section>
    </main>
  );
}

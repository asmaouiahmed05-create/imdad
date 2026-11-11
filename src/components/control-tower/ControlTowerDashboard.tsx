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
import { CustomerOrderStatusBadge } from "@/components/sales/CustomerOrderStatusBadge";
import {
  DELIVERY_SHIPMENT_STATUS_CLASSES,
  DELIVERY_SHIPMENT_STATUS_LABELS,
  type DeliveryShipmentStatus,
} from "@/lib/delivery-state";
import {
  PRODUCTION_ORDER_STATUS_CLASSES,
  PRODUCTION_ORDER_STATUS_LABELS,
  type ProductionOrderStatusValue,
} from "@/lib/production-orders";
import type { PurchaseOrderStatus } from "@/lib/purchase-order-state";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrderStatus,
} from "@/lib/sales-order-state";

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
  production: {
    orderCounts: Record<ProductionOrderStatusValue, number>;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      status: ProductionOrderStatusValue;
      plannedQuantity: string;
      finishedProductName: string;
      revision: number;
    }>;
  };
  sales: {
    orderCounts: Record<CustomerOrderStatus, number>;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      status: CustomerOrderStatus;
      products: string[];
    }>;
  };
  distribution: {
    shipmentCounts: Record<DeliveryShipmentStatus, number>;
    delayedShipmentCount: number;
    recentShipments: Array<{
      id: string;
      reference: string;
      status: DeliveryShipmentStatus;
      expectedDeliveryAt: Date;
      customerName: string;
      region: string;
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

function SourceLabel() {
  return (
    <Badge
      variant="outline"
      className="border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"
    >
      بيانات النظام
    </Badge>
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
        <div className="mt-2">
          <SourceLabel />
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
  const now = new Date();
  const activePurchaseOrders =
    data.procurement.purchaseOrderCounts.SUBMITTED +
    data.procurement.purchaseOrderCounts.PARTIALLY_RECEIVED;
  const activeProductionCount =
    data.production.orderCounts.DRAFT +
    data.production.orderCounts.IN_PROGRESS;
  const activeSalesCount =
    data.sales.orderCounts.DRAFT + data.sales.orderCounts.CONFIRMED;
  const activeDeliveryCount =
    data.distribution.shipmentCounts.PREPARING +
    data.distribution.shipmentCounts.READY_FOR_DISPATCH +
    data.distribution.shipmentCounts.DISPATCHED +
    data.distribution.shipmentCounts.IN_TRANSIT;

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
          label="أوامر إنتاج نشطة · نظام"
          value={numberFormatter.format(activeProductionCount)}
          icon={Factory}
          accent="amber"
        />
        <StatCard
          label="طلبات عملاء مفتوحة · نظام"
          value={numberFormatter.format(activeSalesCount)}
          icon={ShoppingBag}
          accent="blue"
        />
        <StatCard
          label="عمليات توصيل نشطة · نظام"
          value={numberFormatter.format(activeDeliveryCount)}
          icon={Truck}
          accent="violet"
        />
        <StatCard
          label="توصيلات متأخرة · نظام"
          value={numberFormatter.format(data.distribution.delayedShipmentCount)}
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
            subtitle="حالة أوامر الإنتاج المسجلة في النظام."
            href="/production"
            linkLabel="لوحة الإنتاج"
          />
          <div className="grid grid-cols-3 gap-3 p-4">
            {(
              [
                ["DRAFT", "مسودة"],
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
                  {numberFormatter.format(data.production.orderCounts[status])}
                </p>
              </div>
            ))}
          </div>
          {data.production.recentOrders.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">
              لا توجد أوامر إنتاج مسجلة.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {data.production.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/production/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-mono text-xs text-sky-300" dir="ltr">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {order.finishedProductName} ·{" "}
                      {numberFormatter.format(Number(order.plannedQuantity))}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={PRODUCTION_ORDER_STATUS_CLASSES[order.status]}
                  >
                    {PRODUCTION_ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeading
            title="طلبات العملاء والمبيعات"
            subtitle="طلبات العملاء المسجلة في قاعدة البيانات."
            href="/sales/orders"
            linkLabel="طلبات العملاء"
          />
          <div className="grid grid-cols-3 gap-3 p-4">
            {(
              [
                ["DRAFT", CUSTOMER_ORDER_STATUS_LABELS.DRAFT],
                ["CONFIRMED", CUSTOMER_ORDER_STATUS_LABELS.CONFIRMED],
                ["FULFILLED", CUSTOMER_ORDER_STATUS_LABELS.FULFILLED],
              ] as const
            ).map(([status, label]) => (
              <div
                key={status}
                className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-3 sm:p-4"
              >
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {numberFormatter.format(data.sales.orderCounts[status])}
                </p>
              </div>
            ))}
          </div>
          {data.sales.recentOrders.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">
              لا توجد طلبات عملاء مسجلة.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {data.sales.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/sales/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-mono text-xs text-sky-300" dir="ltr">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {order.customerName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.products.join("، ")}
                    </p>
                  </div>
                  <CustomerOrderStatusBadge status={order.status} />
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel className="xl:col-span-2">
          <SectionHeading
            title="عمليات التوصيل والتأخير"
            subtitle={`الشحنات المتأخرة أو المتعذرة وتحديثات حالتها من قاعدة بيانات النظام.`}
            href="/distribution"
            linkLabel="لوحة التوزيع"
          />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">عمليات نشطة</p>
                <p className="mt-2 text-2xl font-semibold text-sky-300">
                  {numberFormatter.format(activeDeliveryCount)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.04] p-4">
                <p className="text-xs text-rose-200">متأخرة</p>
                <p className="mt-2 text-2xl font-semibold text-rose-200">
                  {numberFormatter.format(data.distribution.delayedShipmentCount)}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">تم التسليم</p>
                <p className="mt-2 text-xl font-semibold text-emerald-300">
                  {numberFormatter.format(data.distribution.shipmentCounts.DELIVERED)}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">تعذّر التسليم</p>
                <p className="mt-2 text-xl font-semibold text-rose-300">
                  {numberFormatter.format(data.distribution.shipmentCounts.DELIVERY_FAILED)}
                </p>
              </div>
            </div>
            {data.distribution.recentShipments.length === 0 ? (
              <p className="self-center text-center text-sm text-slate-400">
                لا توجد شحنات متأخرة أو محاولات تعذّر تسليمها.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-slate-950/40">
                {data.distribution.recentShipments.map((shipment) => (
                  <Link
                    key={shipment.id}
                    href={`/distribution/deliveries/${shipment.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="font-mono text-xs text-sky-300" dir="ltr">
                        {shipment.reference}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {shipment.customerName} · {shipment.region}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{dateFormatter.format(shipment.expectedDeliveryAt)}{shipment.expectedDeliveryAt < now && !["DELIVERY_FAILED", "DELIVERED"].includes(shipment.status) ? " · متأخر" : ""}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={DELIVERY_SHIPMENT_STATUS_CLASSES[shipment.status]}
                    >
                      {DELIVERY_SHIPMENT_STATUS_LABELS[shipment.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              مؤشرات التوصيل والشحنات الفعلية مستمدة من سجلات قاعدة بيانات النظام.
            </p>
          </div>
        </DashboardPanel>
      </section>
    </main>
  );
}

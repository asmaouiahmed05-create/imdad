import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { prisma } from "@/lib/db";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import {
  DELIVERY_SHIPMENT_STATUS_CLASSES,
  DELIVERY_SHIPMENT_STATUS_LABELS,
  type DeliveryShipmentStatus,
} from "@/lib/delivery-state";

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
const dateTimeFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});

const activeStatuses: DeliveryShipmentStatus[] = [
  "PREPARING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
];

export default async function DistributionPage() {
  const principal = await getAuthenticatedPrincipal();
  const canManage =
    !!principal && hasPermission(principal.role, "distribution.manage");
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [
    shipmentCounts,
    totalShipments,
    delayedShipments,
    recentShipments,
    completedShipments,
    recentDelivered,
    regionGroups,
    fleetPerformance,
    eligibleOrderCount,
    plannedRunCount,
  ] = await Promise.all([
    prisma.deliveryShipment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.deliveryShipment.count(),
    prisma.deliveryShipment.count({
      where: {
        status: { in: activeStatuses },
        expectedDeliveryAt: { lt: now },
      },
    }),
    prisma.deliveryShipment.findMany({
      select: {
        id: true,
        reference: true,
        status: true,
        customerName: true,
        region: true,
        expectedDeliveryAt: true,
        failedReason: true,
      },
      where: {
        OR: [
          { status: { in: activeStatuses }, expectedDeliveryAt: { lt: now } },
          { status: "DELIVERY_FAILED" },
        ],
      },
      orderBy: [{ expectedDeliveryAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.deliveryShipment.findMany({
      where: { status: "DELIVERED", deliveredAt: { not: null } },
      select: { deliveredAt: true, expectedDeliveryAt: true, inTransitAt: true },
    }),
    prisma.deliveryShipment.findMany({
      where: { status: "DELIVERED", deliveredAt: { gte: sevenDaysAgo } },
      select: { deliveredAt: true },
    }),
    prisma.deliveryShipment.groupBy({
      by: ["region"],
      _count: { _all: true },
      orderBy: { _count: { region: "desc" } },
      take: 6,
    }),
    prisma.$queryRaw<
      Array<{
        driverId: string;
        driverName: string;
        vehicleId: string;
        vehicleLabel: string;
        deliveredStops: number;
        failedStops: number;
      }>
    >`
      SELECT
        driver."id" AS "driverId",
        driver."name" AS "driverName",
        vehicle."id" AS "vehicleId",
        vehicle."label" AS "vehicleLabel",
        COUNT(DISTINCT event."shipmentId") FILTER (
          WHERE event."toStatus" = 'DELIVERED'
        )::int AS "deliveredStops",
        COUNT(DISTINCT event."shipmentId") FILTER (
          WHERE event."toStatus" = 'DELIVERY_FAILED'
        )::int AS "failedStops"
      FROM "DeliveryEvent" event
      JOIN "DeliveryRun" run ON run."id" = event."runId"
      JOIN "DeliveryDriver" driver ON driver."id" = run."driverId"
      JOIN "DeliveryVehicle" vehicle ON vehicle."id" = run."vehicleId"
      WHERE event."toStatus" IN ('DELIVERED', 'DELIVERY_FAILED')
      GROUP BY driver."id", driver."name", vehicle."id", vehicle."label"
      ORDER BY "deliveredStops" DESC, "failedStops" ASC, driver."name" ASC
      LIMIT 8
    `,
    prisma.customerOrder.count({
      where: { status: "FULFILLED", shipment: { is: null } },
    }),
    prisma.deliveryRun.count({ where: { status: "PLANNED" } }),
  ]);
  const counts = Object.fromEntries(
    [
      "PREPARING",
      "READY_FOR_DISPATCH",
      "DISPATCHED",
      "IN_TRANSIT",
      "DELIVERED",
      "DELIVERY_FAILED",
    ].map((status) => [status, 0]),
  ) as Record<DeliveryShipmentStatus, number>;
  for (const entry of shipmentCounts) counts[entry.status] = entry._count._all;
  const deliveredCount = counts.DELIVERED;
  const onTimeCount = completedShipments.filter(
    (shipment) =>
      shipment.deliveredAt &&
      shipment.deliveredAt.getTime() <= shipment.expectedDeliveryAt.getTime(),
  ).length;
  const onTimeRate =
    deliveredCount === 0 ? 0 : (onTimeCount / deliveredCount) * 100;
  const durations = completedShipments.flatMap((shipment) =>
    shipment.inTransitAt && shipment.deliveredAt
      ? [shipment.deliveredAt.getTime() - shipment.inTransitAt.getTime()]
      : [],
  );
  const averageHours =
    durations.length === 0
      ? null
      : durations.reduce((sum, duration) => sum + duration, 0) /
        durations.length /
        3_600_000;
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = date.toLocaleDateString("en-CA", {
      timeZone: "Africa/Algiers",
    });
    const count = recentDelivered.filter(
      (shipment) =>
        shipment.deliveredAt?.toLocaleDateString("en-CA", {
          timeZone: "Africa/Algiers",
        }) === key,
    ).length;
    return { key, count };
  });
  const maxTrend = Math.max(1, ...trend.map((item) => item.count));

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التوزيع
          </p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            لوحة التوزيع والتوصيل
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            متابعة الشحنات المنشأة من طلبات العملاء المكتملة، وتخطيط وإدارة
            عمليات التسليم.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <Button variant="outline" render={<Link href="/distribution/runs/new" />}>
                <CalendarDays aria-hidden="true" />
                تخطيط مسار
              </Button>
              <Button render={<Link href="/distribution/deliveries/new" />}>
              <Plus aria-hidden="true" />
              إنشاء شحنة
              </Button>
            </>
          )}
        </div>
      </section>

      <section
        aria-label="مؤشرات التوصيل"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6"
      >
        <StatCard label="إجمالي الشحنات" value={numberFormatter.format(totalShipments)} icon={PackageCheck} accent="blue" />
        <StatCard label="بانتظار الإرسال" value={numberFormatter.format(counts.PREPARING + counts.READY_FOR_DISPATCH)} icon={Clock3} accent="violet" />
        <StatCard label="قيد التوصيل" value={numberFormatter.format(counts.DISPATCHED + counts.IN_TRANSIT)} icon={Truck} accent="amber" />
        <StatCard label="تم التسليم" value={numberFormatter.format(deliveredCount)} icon={CheckCircle2} accent="emerald" />
        <StatCard label="فاشلة / متأخرة" value={numberFormatter.format(counts.DELIVERY_FAILED + delayedShipments)} icon={AlertTriangle} accent="rose" />
        <StatCard label="التسليم في الموعد" value={`${numberFormatter.format(onTimeRate)}%`} icon={CheckCircle2} accent="blue" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">تنبيهات التشغيل</h2>
              <p className="mt-1 text-xs text-slate-400">
                الشحنات المتأخرة أو التي تحتاج إلى إجراء بعد محاولة فاشلة.
              </p>
            </div>
            <Link href="/distribution/deliveries" className="text-sm text-sky-300 hover:underline">كل الشحنات</Link>
          </div>
          {recentShipments.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-5 text-center text-sm text-slate-400">
              لا توجد تنبيهات عاجلة حاليًا.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
              {recentShipments.map((shipment) => (
                <li key={shipment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/distribution/deliveries/${shipment.id}`} className="font-mono text-xs text-sky-300 hover:underline" dir="ltr">{shipment.reference}</Link>
                    <p className="mt-1 truncate text-sm text-slate-200">{shipment.customerName} · {shipment.region}</p>
                    {shipment.failedReason && <p className="mt-1 line-clamp-2 text-xs text-rose-300">{shipment.failedReason}</p>}
                    {shipment.expectedDeliveryAt < now && shipment.status !== "DELIVERY_FAILED" && <p className="mt-1 text-xs text-rose-300">تجاوز موعد التسليم {dateFormatter.format(shipment.expectedDeliveryAt)}</p>}
                  </div>
                  <Badge variant="outline" className={DELIVERY_SHIPMENT_STATUS_CLASSES[shipment.status]}>{DELIVERY_SHIPMENT_STATUS_LABELS[shipment.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
          <div>
            <h2 className="font-semibold text-white">الأداء والمناطق</h2>
            <p className="mt-1 text-xs text-slate-400">إحصاءات مبنية على سجلات التسليم الفعلية.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <p className="text-xs text-slate-400">معدل إكمال الطلب</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">{numberFormatter.format(totalShipments === 0 ? 0 : deliveredCount / totalShipments * 100)}%</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <p className="text-xs text-slate-400">متوسط مدة التوصيل</p>
              <p className="mt-2 text-2xl font-semibold text-sky-300">{averageHours === null ? "—" : `${numberFormatter.format(averageHours)} س`}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <p className="text-xs text-slate-400">معدل تعذّر التسليم</p>
              <p className="mt-2 text-2xl font-semibold text-rose-300">{numberFormatter.format(totalShipments === 0 ? 0 : counts.DELIVERY_FAILED / totalShipments * 100)}%</p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium text-slate-400">عمليات التسليم · آخر 7 أيام</h3>
            <div className="flex h-24 items-end gap-2 rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-2">
              {trend.map((item) => (
                <div key={item.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-slate-500">{item.count || ""}</span>
                  <div title={`${item.key}: ${item.count}`} className="w-full rounded-t bg-sky-400/70" style={{ height: `${Math.max(4, item.count / maxTrend * 60)}%` }} />
                  <span className="text-[9px] text-slate-500">{item.key.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-slate-400">الشحنات حسب المنطقة</h3>
            {regionGroups.length === 0 ? <p className="text-sm text-slate-500">لا توجد بيانات بعد.</p> : regionGroups.map((region) => (
              <div key={region.region} className="flex justify-between gap-3 text-sm"><span className="truncate text-slate-300">{region.region}</span><span className="text-slate-400">{region._count._all}</span></div>
            ))}
          </div>
          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <h3 className="text-xs font-medium text-slate-400">التسليم حسب السائق والمركبة</h3>
            {fleetPerformance.length === 0 ? <p className="text-sm text-slate-500">تظهر المؤشرات بعد إتمام محاولات توصيل مسندة إلى مسارات.</p> : fleetPerformance.map((item) => (
              <div key={`${item.driverId}:${item.vehicleId}`} className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-slate-300">{item.driverName} · {item.vehicleLabel}</span>
                <span className="text-slate-400">{item.deliveredStops} تم التسليم · {item.failedStops} تعذّر</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold text-white">الطلبات المكتملة دون شحنة</h2><p className="mt-1 text-xs text-slate-400">لا يمكن الشحن إلا بعد اكتمال طلب العميل.</p></div>
            <span className="text-xl font-semibold text-sky-300">{eligibleOrderCount}</span>
          </div>
          {canManage && <Button className="mt-4" variant="outline" render={<Link href="/distribution/deliveries/new" />}>إنشاء شحنة</Button>}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold text-white">المسارات المخططة</h2><p className="mt-1 text-xs text-slate-400">إسناد السائقين والمركبات والتوقفات حسب المنطقة.</p></div>
            <span className="text-xl font-semibold text-violet-300">{plannedRunCount}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/distribution/runs" />}>مسارات التوصيل</Button>
            <Button variant="outline" render={<Link href="/distribution/fleet" />}>إدارة الأسطول</Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-white/[0.06] pt-4 text-sm">
        <Link href="/distribution/deliveries" className="text-sky-300 hover:underline">سجل الشحنات</Link>
        <Link href="/distribution/runs" className="text-sky-300 hover:underline">مسارات التوصيل</Link>
        <Link href="/distribution/fleet" className="text-sky-300 hover:underline">السائقون والمركبات</Link>
        <span className="text-xs text-slate-500">حُسب آخر تحديث: {dateTimeFormatter.format(now)}</span>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import {
  DELIVERY_SHIPMENT_STATUSES,
  DELIVERY_SHIPMENT_STATUS_CLASSES,
  DELIVERY_SHIPMENT_STATUS_LABELS,
  isDeliveryShipmentStatus,
} from "@/lib/delivery-state";
import { ImportExportPanel } from "@/components/data-transfer/ImportExportPanel";

const SHIPMENT_SORT_OPTIONS = [
  "expected_asc",
  "expected_desc",
  "created_desc",
  "customer_asc",
] as const;
type ShipmentSort = (typeof SHIPMENT_SORT_OPTIONS)[number];

function isShipmentSort(value: unknown): value is ShipmentSort {
  return (
    typeof value === "string" &&
    (SHIPMENT_SORT_OPTIONS as readonly string[]).includes(value)
  );
}

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim();
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const status = isDeliveryShipmentStatus(rawStatus) ? rawStatus : undefined;
  const rawSort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort = isShipmentSort(rawSort) ? rawSort : "expected_asc";
  const orderBy =
    sort === "expected_desc"
      ? [{ expectedDeliveryAt: "desc" as const }, { createdAt: "desc" as const }]
      : sort === "created_desc"
        ? [{ createdAt: "desc" as const }]
        : sort === "customer_asc"
          ? [{ customerName: "asc" as const }, { createdAt: "desc" as const }]
          : [{ expectedDeliveryAt: "asc" as const }, { createdAt: "desc" as const }];
  const principal = await getAuthenticatedPrincipal();
  const canManage =
    !!principal && hasPermission(principal.role, "distribution.manage");
  const shipments = await prisma.deliveryShipment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { reference: { contains: query, mode: "insensitive" } },
              { customerName: { contains: query, mode: "insensitive" } },
              { region: { contains: query, mode: "insensitive" } },
              { address: { contains: query, mode: "insensitive" } },
              { order: { orderNumber: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      reference: true,
      status: true,
      customerName: true,
      region: true,
      address: true,
      expectedDeliveryAt: true,
      order: { select: { orderNumber: true } },
      run: { select: { id: true, runNumber: true } },
    },
    orderBy,
    take: 200,
  });

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/distribution" className="mb-4 inline-flex text-sm text-slate-400 hover:text-white">← لوحة التوزيع</Link>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">التوزيع</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">الشحنات</h1>
          <p className="mt-2 text-sm text-slate-400">كل شحنة مرتبطة بطلب مكتمل واحد، مع سجل موثّق لكل تحديث.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportExportPanel
            dataset="deliveries"
            filters={{
              ...(query ? { q: query } : {}),
              ...(status ? { status } : {}),
            }}
          />
          {canManage && <Button render={<Link href="/distribution/deliveries/new" />}><Plus aria-hidden="true" />إنشاء شحنة</Button>}
        </div>
      </section>

      <form className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-4 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">ابحث برقم الشحنة أو الطلب أو العميل أو المنطقة أو العنوان</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input name="q" defaultValue={query} placeholder="ابحث برقم الشحنة أو الطلب أو العميل أو المنطقة..." className="h-10 w-full rounded-lg border border-white/[0.08] bg-slate-950 ps-10 pe-3 text-sm text-slate-100" />
        </label>
        <label className="sr-only" htmlFor="shipment-status">حالة الشحنة</label>
        <select id="shipment-status" name="status" defaultValue={status ?? "ALL"} className="h-10 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100">
          <option value="ALL">كل الحالات</option>
          {DELIVERY_SHIPMENT_STATUSES.map((item) => <option key={item} value={item}>{DELIVERY_SHIPMENT_STATUS_LABELS[item]}</option>)}
        </select>
        <label className="sr-only" htmlFor="shipment-sort">ترتيب الشحنات</label>
        <select id="shipment-sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-white/[0.12] bg-slate-950 px-3 text-sm text-slate-100">
          <option value="expected_asc">الأقرب موعدًا</option>
          <option value="expected_desc">الأبعد موعدًا</option>
          <option value="created_desc">الأحدث إنشاءً</option>
          <option value="customer_asc">العميل أبجديًا</option>
        </select>
        <Button type="submit" variant="outline">تصفية</Button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        {shipments.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-medium text-slate-200">{query || status ? "لا توجد شحنات تطابق البحث." : "لا توجد شحنات بعد."}</p>
            <p className="mt-2 text-sm text-slate-400">تُنشأ الشحنات من طلبات العملاء المكتملة فقط.</p>
            {canManage && <Button className="mt-4" render={<Link href="/distribution/deliveries/new" />}><Plus aria-hidden="true" />إنشاء أول شحنة</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-start text-sm">
              <thead className="bg-white/[0.02] text-xs text-slate-400"><tr>
                <th className="px-5 py-3 font-medium">الشحنة</th><th className="px-5 py-3 font-medium">طلب العميل</th><th className="px-5 py-3 font-medium">العميل</th><th className="px-5 py-3 font-medium">المنطقة والعنوان</th><th className="px-5 py-3 font-medium">الموعد المتوقع</th><th className="px-5 py-3 font-medium">المسار</th><th className="px-5 py-3 font-medium">الحالة</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[0.05]">{shipments.map((shipment) => (
                <tr key={shipment.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-mono text-xs" dir="ltr"><Link href={`/distribution/deliveries/${shipment.id}`} className="text-sky-300 hover:underline">{shipment.reference}</Link></td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-300" dir="ltr">{shipment.order.orderNumber}</td>
                  <td className="px-5 py-4 text-slate-200">{shipment.customerName}</td>
                  <td className="max-w-72 px-5 py-4"><p className="text-slate-200">{shipment.region}</p><p className="mt-1 truncate text-xs text-slate-500">{shipment.address}</p></td>
                  <td className="px-5 py-4 text-slate-300">{dateFormatter.format(shipment.expectedDeliveryAt)}</td>
                  <td className="px-5 py-4 text-slate-300">{shipment.run ? <Link href={`/distribution/runs/${shipment.run.id}`} className="hover:text-sky-300">{shipment.run.runNumber}</Link> : "غير مسند"}</td>
                  <td className="px-5 py-4"><Badge variant="outline" className={DELIVERY_SHIPMENT_STATUS_CLASSES[shipment.status]}>{DELIVERY_SHIPMENT_STATUS_LABELS[shipment.status]}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

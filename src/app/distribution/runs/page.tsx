import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import { ImportExportPanel } from "@/components/data-transfer/ImportExportPanel";
import {
  DELIVERY_PRIORITY_LABELS,
  DELIVERY_RUN_STATUS_LABELS,
} from "@/lib/delivery-state";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default async function DeliveryRunsPage() {
  const [principal, runs] = await Promise.all([
    getAuthenticatedPrincipal(),
    prisma.deliveryRun.findMany({
      select: {
        id: true,
        runNumber: true,
        region: true,
        priority: true,
        scheduledAt: true,
        status: true,
        driver: { select: { name: true } },
        vehicle: { select: { label: true, plate: true, maxStops: true } },
        _count: { select: { shipments: true } },
      },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  const canManage =
    !!principal && hasPermission(principal.role, "distribution.manage");

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/distribution" className="mb-4 inline-flex text-sm text-slate-400 hover:text-white">← لوحة التوزيع</Link>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">التوزيع</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">مسارات التوصيل</h1>
          <p className="mt-2 text-sm text-slate-400">خطط التوقفات حسب المنطقة والتاريخ والسائق والمركبة، دون تتبع GPS أو ادعاء تحسين تلقائي للمسار.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportExportPanel dataset="delivery-runs" />
          {canManage && <Button render={<Link href="/distribution/runs/new" />}><Plus aria-hidden="true" />تخطيط مسار</Button>}
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        {runs.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-medium text-slate-200">لا توجد مسارات مخططة.</p>
            <p className="mt-2 text-sm text-slate-400">سجّل سائقًا ومركبة نشطين ثم أضف الشحنات الجاهزة إلى المسار.</p>
            {canManage && <Button className="mt-4" render={<Link href="/distribution/runs/new" />}><Plus aria-hidden="true" />تخطيط أول مسار</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-start text-sm">
              <thead className="bg-white/[0.02] text-xs text-slate-400"><tr>
                <th className="px-5 py-3 font-medium">رقم المسار</th><th className="px-5 py-3 font-medium">المنطقة / التاريخ</th><th className="px-5 py-3 font-medium">السائق والمركبة</th><th className="px-5 py-3 font-medium">التوقفات</th><th className="px-5 py-3 font-medium">الأولوية</th><th className="px-5 py-3 font-medium">الحالة</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[0.05]">{runs.map((run) => (
                <tr key={run.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-mono text-xs" dir="ltr"><Link href={`/distribution/runs/${run.id}`} className="text-sky-300 hover:underline">{run.runNumber}</Link></td>
                  <td className="px-5 py-4"><p className="text-slate-200">{run.region}</p><p className="mt-1 text-xs text-slate-500">{dateFormatter.format(run.scheduledAt)}</p></td>
                  <td className="px-5 py-4"><p className="text-slate-200">{run.driver.name}</p><p className="mt-1 text-xs text-slate-500">{run.vehicle.label} · {run.vehicle.plate}</p></td>
                  <td className="px-5 py-4 text-slate-300">{run._count.shipments} / {run.vehicle.maxStops}</td>
                  <td className="px-5 py-4 text-slate-300">{DELIVERY_PRIORITY_LABELS[run.priority]}</td>
                  <td className="px-5 py-4"><Badge variant="outline">{DELIVERY_RUN_STATUS_LABELS[run.status]}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

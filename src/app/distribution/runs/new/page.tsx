import Link from "next/link";
import { DeliveryRunCreateForm } from "@/components/distribution/DeliveryRunCreateForm";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";

export default async function NewDeliveryRunPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string | string[] }>;
}) {
  await requirePagePermission("distribution.manage");
  const params = await searchParams;
  const rawRegion = Array.isArray(params.region) ? params.region[0] : params.region;
  const defaultRegion = rawRegion?.trim().slice(0, 120);
  const [drivers, vehicles] = await Promise.all([
    prisma.deliveryDriver.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.deliveryVehicle.findMany({
      where: { isActive: true },
      select: { id: true, plate: true, label: true, maxStops: true },
      orderBy: { plate: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href="/distribution/runs" className="inline-flex text-sm text-slate-400 hover:text-white">← مسارات التوصيل</Link>
      <section className="space-y-5 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">التوزيع</p>
          <h1 className="text-xl font-semibold text-white">تخطيط مسار توصيل</h1>
          <p className="mt-2 text-sm text-slate-400">المسار خطة تشغيلية ثابتة؛ لا يتضمن تتبعًا مباشرًا أو حسابًا آليًا للمسار.</p>
        </div>
        <DeliveryRunCreateForm drivers={drivers} vehicles={vehicles} defaultRegion={defaultRegion} />
      </section>
    </main>
  );
}

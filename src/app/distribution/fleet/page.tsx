import Link from "next/link";
import { FleetManagement } from "@/components/distribution/FleetManagement";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { ImportExportPanel } from "@/components/data-transfer/ImportExportPanel";

export default async function DistributionFleetPage() {
  const [principal, drivers, vehicles] = await Promise.all([
    getAuthenticatedPrincipal(),
    prisma.deliveryDriver.findMany({
      select: { id: true, name: true, phone: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.deliveryVehicle.findMany({
      select: {
        id: true,
        plate: true,
        label: true,
        type: true,
        maxStops: true,
        isActive: true,
      },
      orderBy: { plate: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/distribution" className="mb-4 inline-flex text-sm text-slate-400 hover:text-white">← لوحة التوزيع</Link>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">التوزيع</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">السائقون والمركبات</h1>
          <p className="mt-2 text-sm text-slate-400">إدارة أساسية لسعة التوقفات والتوفر قبل تخطيط مسارات التوصيل.</p>
        </div>
        <ImportExportPanel dataset="fleet" />
      </section>
      <FleetManagement
        drivers={drivers}
        vehicles={vehicles}
        canManage={
          !!principal && hasPermission(principal.role, "distribution.manage")
        }
      />
    </main>
  );
}

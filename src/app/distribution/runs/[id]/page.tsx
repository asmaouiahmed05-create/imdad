import { notFound } from "next/navigation";
import { DeliveryRunDetail } from "@/components/distribution/DeliveryRunDetail";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export default async function DeliveryRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [principal, run] = await Promise.all([
    getAuthenticatedPrincipal(),
    prisma.deliveryRun.findUnique({
      where: { id },
      include: {
        driver: { select: { name: true, phone: true } },
        vehicle: { select: { plate: true, label: true, maxStops: true } },
        shipments: {
          select: {
            id: true,
            reference: true,
            status: true,
            customerName: true,
            address: true,
            region: true,
            expectedDeliveryAt: true,
            order: { select: { orderNumber: true } },
          },
          orderBy: [{ expectedDeliveryAt: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);
  if (!run) notFound();

  return (
    <DeliveryRunDetail
      run={run}
      canManage={
        !!principal && hasPermission(principal.role, "distribution.manage")
      }
    />
  );
}

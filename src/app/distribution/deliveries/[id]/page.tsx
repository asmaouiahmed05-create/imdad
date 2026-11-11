import { notFound } from "next/navigation";
import { ShipmentDetail } from "@/components/distribution/ShipmentDetail";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { deliveryDayRange } from "@/lib/delivery-state";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [principal, shipment] = await Promise.all([
    getAuthenticatedPrincipal(),
    prisma.deliveryShipment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            fulfilledAt: true,
            lines: {
              select: {
                id: true,
                productName: true,
                productSku: true,
                unit: true,
                orderedQuantity: true,
              },
              orderBy: { id: "asc" },
            },
          },
        },
        run: {
          include: {
            driver: { select: { name: true, phone: true } },
            vehicle: { select: { plate: true, label: true } },
          },
        },
        events: {
          include: {
            actor: { select: { name: true } },
            run: { select: { runNumber: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
      },
    }),
  ]);
  if (!shipment) notFound();

  const shipmentDay = deliveryDayRange(shipment.expectedDeliveryAt);
  const availableRuns = await prisma.deliveryRun.findMany({
    where: {
      status: "PLANNED",
      region: { equals: shipment.region, mode: "insensitive" },
      scheduledAt: { gte: shipmentDay.start, lt: shipmentDay.end },
    },
    select: {
      id: true,
      runNumber: true,
      vehicle: { select: { maxStops: true } },
      _count: { select: { shipments: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { runNumber: "asc" }],
  });
  const currentPrincipal = principal;

  return (
    <ShipmentDetail
      shipment={{
        ...shipment,
        run: shipment.run
          ? {
              id: shipment.run.id,
              runNumber: shipment.run.runNumber,
              status: shipment.run.status,
              driver: shipment.run.driver,
              vehicle: shipment.run.vehicle,
            }
          : null,
      }}
      availableRuns={availableRuns
        .filter((run) => run._count.shipments < run.vehicle.maxStops)
        .map((run) => ({
          id: run.id,
          runNumber: run.runNumber,
          remainingStops: run.vehicle.maxStops - run._count.shipments,
        }))}
      canManage={
        !!currentPrincipal &&
        hasPermission(currentPrincipal.role, "distribution.manage")
      }
    />
  );
}

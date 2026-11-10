import { notFound } from "next/navigation";
import { SalesOrderDetail } from "@/components/sales/SalesOrderDetail";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requirePagePermission("sales.read");
  const { id } = await params;
  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      lines: { include: { reservations: true } },
      movements: {
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  return (
    <SalesOrderDetail
      order={order}
      canManage={hasPermission(principal.role, "sales.order.manage")}
    />
  );
}

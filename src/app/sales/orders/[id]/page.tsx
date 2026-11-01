import { SalesOrderDetail } from "@/components/sales/SalesOrderDetail";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SalesOrderDetail orderId={id} />;
}

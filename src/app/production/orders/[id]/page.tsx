import { ProductionOrderDetail } from "@/components/production/ProductionOrderDetail";

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductionOrderDetail orderId={id} />;
}

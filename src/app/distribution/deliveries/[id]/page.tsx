import { DeliveryDetail } from "@/components/distribution/DeliveryDetail";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeliveryDetail deliveryId={id} />;
}

import { prisma } from "@/lib/db";
import { RecordMovementDialog } from "./RecordMovementDialog";

export async function RecordMovementButton() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, unit: true },
  });
  return <RecordMovementDialog products={products} />;
}

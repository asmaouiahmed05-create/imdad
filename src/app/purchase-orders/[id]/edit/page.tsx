import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PurchaseOrderForm } from "@/components/purchasing/PurchaseOrderForm";
import { prisma } from "@/lib/db";

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const [order, activeSuppliers, products] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!order) notFound();
  if (order.status !== "DRAFT") redirect(`/purchase-orders/${id}`);
  const suppliers = order.supplier.isActive
    ? activeSuppliers
    : [
        {
          id: order.supplier.id,
          name: order.supplier.name,
          isActive: false,
        },
        ...activeSuppliers,
      ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href={`/purchase-orders/${id}`} className="text-sm text-slate-400 hover:text-white">
        العودة إلى الأمر
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="font-mono text-sm text-sky-300" dir="ltr">
          {order.orderNumber}
        </p>
        <h2 className="mb-6 mt-2 text-xl font-semibold text-white">
          تعديل مسودة أمر الشراء
        </h2>
        <PurchaseOrderForm
          orderId={order.id}
          suppliers={suppliers}
          products={products}
          initialSupplierId={order.supplierId}
          initialLines={order.lines.map((line) => ({
            productId: line.productId,
            quantity: line.orderedQuantity,
          }))}
        />
      </section>
    </main>
  );
}

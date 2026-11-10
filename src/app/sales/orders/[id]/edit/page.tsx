import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SalesOrderForm } from "@/components/sales/SalesOrderForm";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { calculateAvailableQuantity } from "@/lib/sales-order-operations";

export default async function EditSalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("sales.order.manage");
  const { id } = await params;
  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!order) notFound();
  if (order.status !== "DRAFT") redirect(`/sales/orders/${id}`);

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [{ isActive: true }, { id: order.customerId }],
      },
      select: { id: true, name: true, city: true, isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.product.findMany({
      where: { classification: { in: ["FINISHED_GOOD", "BOTH"] } },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  const reservations = products.length
    ? await prisma.customerOrderReservation.groupBy({
        by: ["productId"],
        where: {
          productId: { in: products.map((product) => product.id) },
          releasedAt: null,
        },
        _sum: { quantity: true },
      })
    : [];
  const reservedByProduct = new Map(
    reservations.map((entry) => [entry.productId, entry._sum.quantity ?? 0]),
  );

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href={`/sales/orders/${order.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        تفاصيل الطلب
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 font-mono text-xs text-sky-300" dir="ltr">
          {order.orderNumber}
        </p>
        <h1 className="mb-2 text-xl font-semibold text-white">
          تعديل مسودة طلب العميل
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          لا يمكن تعديل الطلب بعد تأكيده أو حجز المخزون.
        </p>
        <SalesOrderForm
          order={{
            id: order.id,
            customerId: order.customerId,
            expectedFulfillmentAt: order.expectedFulfillmentAt,
            notes: order.notes,
            updatedAt: order.updatedAt,
            lines: order.lines.map((line) => ({
              productId: line.productId,
              quantity: line.orderedQuantity,
            })),
          }}
          customers={customers}
          products={products.map((product) => ({
            ...product,
            available:
              calculateAvailableQuantity(
                product.quantity,
                reservedByProduct.get(product.id) ?? 0,
              ) ?? 0,
          }))}
        />
      </section>
    </main>
  );
}

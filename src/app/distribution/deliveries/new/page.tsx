import Link from "next/link";
import { notFound } from "next/navigation";
import { ShipmentCreateForm } from "@/components/distribution/ShipmentCreateForm";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  await requirePagePermission("distribution.manage");
  const params = await searchParams;
  const requestedOrderId = Array.isArray(params.order)
    ? params.order[0]
    : params.order;
  const orders = await prisma.customerOrder.findMany({
    where: { status: "FULFILLED", shipment: { is: null } },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customer: { select: { city: true, address: true, phone: true } },
      lines: {
        select: {
          productName: true,
          productSku: true,
          orderedQuantity: true,
          unit: true,
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ fulfilledAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  if (requestedOrderId && !orders.some((order) => order.id === requestedOrderId)) {
    const alreadyExists = await prisma.customerOrder.findUnique({
      where: { id: requestedOrderId },
      select: { status: true, shipment: { select: { id: true } } },
    });
    if (!alreadyExists) notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href="/distribution" className="inline-flex text-sm text-slate-400 hover:text-white">← لوحة التوزيع</Link>
      <section className="space-y-5 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">التوزيع</p>
          <h1 className="text-xl font-semibold text-white">إنشاء شحنة من طلب مكتمل</h1>
          <p className="mt-2 text-sm text-slate-400">يُحفظ العميل والعنوان كنسخة تشغيلية مرتبطة بالطلب، ولا يُنشأ مخزون أو حركة صرف جديدة.</p>
        </div>
        <ShipmentCreateForm
          orders={orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            city: order.customer.city,
            address: order.customer.address,
            phone: order.customer.phone,
            lines: order.lines,
          }))}
          defaultOrderId={requestedOrderId}
        />
      </section>
    </main>
  );
}

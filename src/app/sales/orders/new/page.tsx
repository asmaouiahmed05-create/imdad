import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { SalesOrderForm } from "@/components/sales/SalesOrderForm";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { calculateAvailableQuantity } from "@/lib/sales-order-operations";

type SearchParams = Promise<{ customer?: string | string[] }>;

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("sales.order.manage");
  await connection();
  const params = await searchParams;
  const requestedCustomerId = Array.isArray(params.customer)
    ? params.customer[0]
    : params.customer;

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true },
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
  const customerId = customers.some(
    (customer) => customer.id === requestedCustomerId,
  )
    ? requestedCustomerId
    : undefined;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/sales/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        طلبات العملاء
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          المبيعات
        </p>
        <h1 className="mb-2 text-xl font-semibold text-white">
          إنشاء مسودة طلب عميل
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          اختر العميل والمنتجات النهائية والكميات المطلوبة. يُعاد التحقق من
          التوفر عند التأكيد.
        </p>
        <SalesOrderForm
          customers={customers}
          products={products.map((product) => ({
            ...product,
            available:
              calculateAvailableQuantity(
                product.quantity,
                reservedByProduct.get(product.id) ?? 0,
              ) ?? 0,
          }))}
          idempotencyKey={randomUUID()}
          defaultCustomerId={customerId}
        />
      </section>
    </main>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PurchaseOrderForm } from "@/components/purchasing/PurchaseOrderForm";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("purchase_order.create");
  await connection();
  const params = await searchParams;
  const rawSupplierId = params.supplierId;
  const requestedSupplierId = Array.isArray(rawSupplierId)
    ? rawSupplierId[0]
    : rawSupplierId;
  const [suppliers, products] = await Promise.all([
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
  if (
    requestedSupplierId &&
    !suppliers.some((supplier) => supplier.id === requestedSupplierId)
  ) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <Link href="/purchase-orders" className="text-sm text-slate-400 hover:text-white">
        أوامر الشراء
      </Link>
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
          طلب توريد جديد
        </p>
        <h2 className="mb-2 text-xl font-semibold text-white">إنشاء أمر شراء</h2>
        <p className="mb-6 text-sm text-slate-400">
          سيبدأ الأمر كمسودة، ولا يتغير المخزون إلا بعد تسجيل الاستلام.
        </p>
        <PurchaseOrderForm
          suppliers={suppliers}
          products={products}
          initialSupplierId={requestedSupplierId}
        />
      </section>
    </main>
  );
}

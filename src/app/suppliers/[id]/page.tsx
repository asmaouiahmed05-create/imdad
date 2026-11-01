import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Pencil, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/PurchaseOrderStatusBadge";
import { SupplierStatusControl } from "@/components/purchasing/SupplierStatusControl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});
const numberFormatter = new Intl.NumberFormat("ar-DZ");

export default async function SupplierDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await requirePagePermission("supplier.read");
  const canManage = hasPermission(principal.role, "supplier.manage");
  const canCreatePurchaseOrder = hasPermission(principal.role, "purchase_order.create");
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const savedValue = query.saved;
  const saved = (Array.isArray(savedValue) ? savedValue[0] : savedValue) === "1";
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { purchaseOrders: true } },
    },
  });
  if (!supplier) notFound();

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/suppliers" className="text-sm text-slate-400 hover:text-white">
            الموردون
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {supplier.name}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <Button variant="outline" render={<Link href={`/suppliers/${id}/edit`} />}>
                <Pencil aria-hidden="true" />
                تعديل البيانات
              </Button>
              <SupplierStatusControl
                supplierId={supplier.id}
                supplierName={supplier.name}
                isActive={supplier.isActive}
                purchaseOrderCount={supplier._count.purchaseOrders}
              />
            </>
          )}
          {supplier.isActive && canCreatePurchaseOrder && (
            <Button render={<Link href={`/purchase-orders/new?supplierId=${encodeURIComponent(id)}`} />}>
              <ShoppingCart aria-hidden="true" />
              إنشاء أمر شراء
            </Button>
          )}
        </div>
      </div>

      {saved && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300"
        >
          تم حفظ بيانات المورد بنجاح.
        </p>
      )}

      <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">الحالة</p>
          <div className="mt-2">
            <Badge
              variant="outline"
              className={
                supplier.isActive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-500/30 bg-slate-500/10 text-slate-400"
              }
            >
              {supplier.isActive ? "نشط" : "غير نشط"}
            </Badge>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500">الشخص المسؤول</p>
          <p className="mt-2 text-sm text-slate-200">{supplier.contactPerson || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">الهاتف</p>
          <p className="mt-2 text-sm text-slate-200" dir="auto">{supplier.phone || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">البريد الإلكتروني</p>
          <p className="mt-2 text-sm text-slate-200" dir="ltr">{supplier.email || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">العنوان</p>
          <p className="mt-2 text-sm text-slate-200">{supplier.address || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">إجمالي أوامر الشراء المرتبطة</p>
          <p className="mt-2 text-sm text-slate-200">
            {numberFormatter.format(supplier._count.purchaseOrders)}
          </p>
        </div>
        {supplier.notes && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-slate-500">ملاحظات</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {supplier.notes}
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <h3 className="font-semibold text-white">أوامر الشراء</h3>
          <span className="text-xs text-slate-400">
            أحدث {numberFormatter.format(supplier.purchaseOrders.length)} من{" "}
            {numberFormatter.format(supplier._count.purchaseOrders)}
          </span>
        </div>
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>رقم الأمر</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead>عدد الأصناف</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplier.purchaseOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={`/purchase-orders/${order.id}`} className="font-mono text-sky-300 hover:text-sky-200" dir="ltr">
                    {order.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>{dateFormatter.format(order.createdAt)}</TableCell>
                <TableCell>{numberFormatter.format(order._count.lines)}</TableCell>
                <TableCell><PurchaseOrderStatusBadge status={order.status} /></TableCell>
              </TableRow>
            ))}
            {supplier.purchaseOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-sm text-slate-400">
                  لا توجد أوامر شراء لهذا المورد بعد.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}

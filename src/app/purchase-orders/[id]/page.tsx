import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Pencil, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PurchaseOrderReceiptForm } from "@/components/purchasing/PurchaseOrderReceiptForm";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/PurchaseOrderStatusBadge";
import { PurchaseOrderTransitions } from "@/components/purchasing/PurchaseOrderTransitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});
const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 4,
});

export default async function PurchaseOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("purchase_order.read");
  await connection();
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: {
        include: {
          movements: {
            select: {
              id: true,
              quantity: true,
              createdAt: true,
              reason: true,
              reference: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/purchase-orders" className="text-sm text-slate-400 hover:text-white">
            أوامر الشراء
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-white sm:text-2xl" dir="ltr">
              {order.orderNumber}
            </h2>
            <PurchaseOrderStatusBadge status={order.status} />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            أُنشئ في {dateFormatter.format(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === "DRAFT" && (
            <Button variant="outline" render={<Link href={`/purchase-orders/${id}/edit`} />}>
              <Pencil aria-hidden="true" />
              تعديل المسودة
            </Button>
          )}
          <PurchaseOrderTransitions id={id} status={order.status} />
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">المورد</p>
          <Link href={`/suppliers/${order.supplier.id}`} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-sky-300 hover:text-sky-200">
            <Truck aria-hidden="true" className="size-4" />
            {order.supplier.name}
          </Link>
        </div>
        <div>
          <p className="text-xs text-slate-500">جهة الاتصال</p>
          <p className="mt-2 text-sm text-slate-200">{order.supplier.contactPerson || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">تاريخ الإرسال</p>
          <p className="mt-2 text-sm text-slate-200">
            {order.submittedAt ? dateFormatter.format(order.submittedAt) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">تاريخ اكتمال الاستلام</p>
          <p className="mt-2 text-sm text-slate-200">
            {order.receivedAt ? dateFormatter.format(order.receivedAt) : "—"}
          </p>
        </div>
        {order.cancelledAt && (
          <div>
            <p className="text-xs text-slate-500">تاريخ الإلغاء</p>
            <p className="mt-2 text-sm text-slate-200">
              {dateFormatter.format(order.cancelledAt)}
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h3 className="font-semibold text-white">أصناف أمر الشراء</h3>
          <p className="mt-1 text-xs text-slate-400">
            أسماء الأصناف ووحداتها محفوظة كما كانت وقت إنشاء المسودة. لا يتضمن هذا الأمر أسعارًا أو إجماليات مالية.
          </p>
        </div>
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>الصنف</TableHead>
              <TableHead>SKU وقت الطلب</TableHead>
              <TableHead>الكمية المطلوبة</TableHead>
              <TableHead>الكمية المستلمة</TableHead>
              <TableHead>المتبقي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium text-slate-100">
                  {line.productName}
                </TableCell>
                <TableCell dir="ltr" className="font-mono text-xs">
                  {line.productSku}
                </TableCell>
                <TableCell>
                  {numberFormatter.format(line.orderedQuantity)} {line.unit}
                </TableCell>
                <TableCell>
                  {numberFormatter.format(line.receivedQuantity)} {line.unit}
                </TableCell>
                <TableCell>
                  {numberFormatter.format(
                    Math.max(0, line.orderedQuantity - line.receivedQuantity),
                  )}{" "}
                  {line.unit}
                </TableCell>
              </TableRow>
            ))}
            {order.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-sm text-slate-400">
                  لا توجد أصناف. عدّل المسودة لإضافة أصناف قبل إرسالها.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {(order.status === "SUBMITTED" ||
        order.status === "PARTIALLY_RECEIVED") && (
        <section className="rounded-2xl border border-sky-400/10 bg-slate-900/75 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">تسجيل استلام</h3>
              <p className="mt-1 text-xs text-slate-400">
                أدخل كميات هذا الاستلام فقط. لا يمكن تجاوز الكمية المتبقية لكل صنف.
              </p>
            </div>
            <Badge variant="outline" className="border-sky-400/20 text-sky-300">
              حركة مخزون مرتبطة
            </Badge>
          </div>
          <PurchaseOrderReceiptForm
            id={id}
            receiptToken={randomUUID()}
            lines={order.lines.map((line) => ({
              id: line.id,
              productName: line.productName,
              unit: line.unit,
              orderedQuantity: line.orderedQuantity,
              receivedQuantity: line.receivedQuantity,
            }))}
          />
        </section>
      )}

      {order.lines.some((line) => line.movements.length > 0) && (
        <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5">
          <h3 className="mb-4 font-semibold text-white">سجل استلامات هذا الأمر</h3>
          <div className="space-y-4">
            {order.lines.flatMap((line) =>
              line.movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm text-slate-200">{line.productName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateFormatter.format(movement.createdAt)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm text-emerald-300">
                      +{numberFormatter.format(movement.quantity)} {line.unit}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500" dir="ltr">
                      {movement.reference}
                    </p>
                  </div>
                </div>
              )),
            )}
          </div>
        </section>
      )}
    </main>
  );
}

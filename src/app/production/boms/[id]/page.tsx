import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BomTransitionControls } from "@/components/production/BomTransitionControls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasPermission } from "@/lib/authorization";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { BOM_STATUS_LABELS } from "@/lib/production-bom";

const statusClasses = {
  DRAFT: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  RELEASED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  RETIRED: "border-amber-400/20 bg-amber-400/10 text-amber-300",
} as const;

const quantityFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 6,
});

export default async function BillOfMaterialsDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requirePagePermission("production.bom.read");
  const { id } = await params;
  const bom = await prisma.billOfMaterials.findUnique({
    where: { id },
    include: {
      finishedProduct: { select: { name: true, sku: true, unit: true } },
      components: { orderBy: { materialName: "asc" } },
    },
  });
  if (!bom) notFound();
  const finishedProductName =
    bom.status === "DRAFT" ? bom.finishedProduct.name : bom.finishedProductName;
  const finishedProductSku =
    bom.status === "DRAFT" ? bom.finishedProduct.sku : bom.finishedProductSku;
  const finishedProductUnit =
    bom.status === "DRAFT" ? bom.finishedProduct.unit : bom.finishedProductUnit;

  return (
    <main className="mx-auto w-full max-w-[1300px] space-y-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/production/boms"
        className="text-sm text-slate-400 hover:text-white"
      >
        قوائم المواد
      </Link>

      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-sky-300">
              قائمة مواد محفوظة في قاعدة البيانات
            </p>
            <h1 className="text-2xl font-semibold text-white">
              {finishedProductName}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {finishedProductSku} · المراجعة {bom.revision} · لكل{" "}
              {finishedProductUnit} واحد
            </p>
            <Badge
              variant="outline"
              className={`mt-4 rounded-full ${statusClasses[bom.status]}`}
            >
              {BOM_STATUS_LABELS[bom.status]}
            </Badge>
          </div>
          <BomTransitionControls
            id={bom.id}
            status={bom.status}
            canManage={hasPermission(principal.role, "production.bom.manage")}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-semibold text-white">مكونات قائمة المواد</h2>
          <p className="mt-1 text-xs text-slate-400">
            الكميات محفوظة لكل وحدة؛ هذه البيانات لا تخصم مواد ولا تغيّر المخزون.
          </p>
        </div>
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead>المادة الأولية</TableHead>
              <TableHead>رمز SKU</TableHead>
              <TableHead>الكمية لكل وحدة</TableHead>
              <TableHead>الوحدة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bom.components.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center text-slate-400">
                  لا توجد مكونات مضافة.
                </TableCell>
              </TableRow>
            ) : (
              bom.components.map((component) => (
                <TableRow key={component.id} className="border-white/[0.05]">
                  <TableCell className="font-medium text-slate-100">
                    {component.materialName}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {component.materialSku}
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-200">
                    {quantityFormatter.format(Number(component.quantityPerUnit))}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {component.unit}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm leading-6 text-amber-100">
        تُستخدم هذه المراجعة لتخطيط أوامر الإنتاج؛ لا تغيّر بيانات قائمة المواد
        رصيد المخزون. تُسجّل حركات المواد والمخرجات عند إكمال أمر إنتاج بنجاح.
      </p>
    </main>
  );
}

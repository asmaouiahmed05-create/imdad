import Link from "next/link";
import { FilePlus2, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { hasPermission } from "@/lib/authorization";
import { BOM_STATUS_LABELS } from "@/lib/production-bom";

const statusClasses = {
  DRAFT: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  RELEASED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  RETIRED: "border-amber-400/20 bg-amber-400/10 text-amber-300",
} as const;

export default async function BillOfMaterialsPage() {
  const principal = await requirePagePermission("production.bom.read");
  const boms = await prisma.billOfMaterials.findMany({
    include: {
      finishedProduct: { select: { name: true, sku: true } },
      _count: { select: { components: true } },
    },
    orderBy: [{ finishedProduct: { name: "asc" } }, { revision: "desc" }],
  });
  const canManage = hasPermission(principal.role, "production.bom.manage");

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/production"
            className="text-sm text-slate-400 hover:text-white"
          >
            الإنتاج والعمليات
          </Link>
          <p className="mb-2 mt-4 text-xs font-semibold tracking-[0.16em] text-sky-300">
            بيانات تشغيلية محفوظة
          </p>
          <h1 className="text-2xl font-semibold text-white">
            قوائم المواد والإصدارات
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            قوائم مواد محفوظة في قاعدة البيانات، منفصلة عن أوامر الإنتاج
            التجريبية المحفوظة محليًا في المتصفح.
          </p>
        </div>
        {canManage && (
          <Button render={<Link href="/production/boms/new" />}>
            <FilePlus2 aria-hidden="true" className="size-4" />
            قائمة مواد جديدة
          </Button>
        )}
      </header>

      <section className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
          <Layers3 aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">إجمالي المراجعات</p>
          <p className="mt-1 text-xs text-slate-400">
            {boms.length} مراجعة محفوظة
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead>المنتج النهائي</TableHead>
              <TableHead>المراجعة</TableHead>
              <TableHead>عدد المواد</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>تاريخ التحديث</TableHead>
              <TableHead className="text-end">التفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <p className="font-medium text-slate-200">
                    لا توجد قوائم مواد محفوظة بعد.
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    صنّف المنتجات أولًا، ثم أنشئ مسودة قائمة مواد.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              boms.map((bom) => (
                <TableRow key={bom.id} className="border-white/[0.05]">
                  <TableCell>
                    <span className="font-medium text-white">
                      {bom.finishedProduct.name}
                    </span>
                    <span className="ms-2 font-mono text-xs text-slate-500">
                      {bom.finishedProduct.sku}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-300">
                    {bom.revision}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {bom._count.components}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-full ${statusClasses[bom.status]}`}
                    >
                      {BOM_STATUS_LABELS[bom.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {new Intl.DateTimeFormat("ar-DZ", {
                      dateStyle: "medium",
                      timeZone: "Africa/Algiers",
                    }).format(bom.updatedAt)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/production/boms/${bom.id}`} />}
                    >
                      فتح
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}

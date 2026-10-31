import Link from "next/link";
import {
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Factory,
  PlayCircle,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockOrders = [
  {
    number: "PRD-2026-001",
    product: "كرسي مكتبي",
    quantity: "120 قطعة",
    dates: "2026/10/28 – 2026/11/04",
    status: "قيد الإنتاج",
    statusClass: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  },
  {
    number: "PRD-2026-002",
    product: "طاولة اجتماعات",
    quantity: "24 قطعة",
    dates: "2026/10/30 – 2026/11/08",
    status: "مخطط",
    statusClass: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
  {
    number: "PRD-2026-003",
    product: "رف تخزين معدني",
    quantity: "60 قطعة",
    dates: "2026/10/20 – 2026/10/29",
    status: "مكتمل",
    statusClass: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  {
    number: "PRD-2026-004",
    product: "خزانة ملفات",
    quantity: "35 قطعة",
    dates: "2026/11/02 – 2026/11/12",
    status: "مسودة",
    statusClass: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  },
];

export default function ProductionPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            التصنيع
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            لوحة الإنتاج
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            نظرة عامة على أوامر وخطط الإنتاج.
          </p>
        </div>
        <Button render={<Link href="/production/orders/new" />}>
          <Plus aria-hidden="true" />
          إنشاء أمر إنتاج
        </Button>
      </section>

      <p
        role="note"
        className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200"
      >
        وضع تجريبي: الأرقام وأوامر الإنتاج المعروضة بيانات نموذجية وليست بيانات
        محفوظة أو مرتبطة بالمخزون.
      </p>

      <section
        aria-label="ملخص الإنتاج التجريبي"
        className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="إجمالي أوامر الإنتاج"
          value="12"
          icon={ClipboardList}
          accent="blue"
        />
        <StatCard
          label="مخطط"
          value="4"
          icon={CalendarDays}
          accent="violet"
        />
        <StatCard
          label="قيد الإنتاج"
          value="3"
          icon={PlayCircle}
          accent="amber"
        />
        <StatCard
          label="مكتمل"
          value="5"
          icon={CircleCheck}
          accent="emerald"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <Factory aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                أوامر الإنتاج
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                قائمة نموذجية للتوضيح فقط.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-white/10 bg-slate-900 px-3 py-2 text-slate-300"
          >
            4 أوامر نموذجية
          </Badge>
        </div>

        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>رقم الأمر</TableHead>
              <TableHead>المنتج النهائي</TableHead>
              <TableHead>الكمية المخططة</TableHead>
              <TableHead>فترة الإنتاج</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockOrders.map((order) => (
              <TableRow key={order.number}>
                <TableCell dir="ltr" className="font-mono text-xs">
                  {order.number}
                </TableCell>
                <TableCell className="font-medium">{order.product}</TableCell>
                <TableCell>{order.quantity}</TableCell>
                <TableCell dir="ltr" className="text-slate-300">
                  {order.dates}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={order.statusClass}
                  >
                    {order.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}

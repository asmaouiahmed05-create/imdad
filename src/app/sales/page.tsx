"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  PackageCheck,
  Plus,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  DEMO_CUSTOMERS,
  SALES_STATUS_CLASSES,
  SALES_STATUS_LABELS,
  type SalesStatus,
} from "@/lib/sales-demo";

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export default function SalesPage() {
  const { orders, ready, error } = useSalesDemo();
  const countByStatus = (status: SalesStatus) =>
    orders.filter((order) => order.status === status).length;

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sky-300">
            المبيعات والعملاء
          </p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            لوحة طلبات العملاء
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            تابع الطلب من تسجيله إلى مرحلة التسليم.
          </p>
        </div>
        <Button render={<Link href="/sales/orders/new" />}>
          <Plus aria-hidden="true" />
          إنشاء طلب عميل
        </Button>
      </section>

      <p
        role="note"
        className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-200"
      >
        نموذج تجريبي: تُحفظ الطلبات في هذا المتصفح فقط. لا توجد معالجة فعلية
        للتسليم أو الدفع، ولا تتغير كميات المخزون أو حركاته.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      <section
        aria-label="ملخص طلبات العملاء"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="إجمالي الطلبات"
          value={ready ? numberFormatter.format(orders.length) : "—"}
          icon={ClipboardList}
          accent="blue"
        />
        <StatCard
          label="طلبات جديدة"
          value={ready ? numberFormatter.format(countByStatus("NEW")) : "—"}
          icon={Clock3}
          accent="violet"
        />
        <StatCard
          label="قيد التحضير"
          value={
            ready ? numberFormatter.format(countByStatus("PREPARING")) : "—"
          }
          icon={PackageCheck}
          accent="amber"
        />
        <StatCard
          label="تم التسليم"
          value={
            ready ? numberFormatter.format(countByStatus("DELIVERED")) : "—"
          }
          icon={PackageCheck}
          accent="emerald"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                أحدث الطلبات
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                آخر الطلبات المسجلة في بيانات العرض.
              </p>
            </div>
            <Link
              href="/sales/orders"
              className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
            >
              كل الطلبات <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {!ready ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              جارٍ تحميل الطلبات...
            </p>
          ) : orders.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-medium text-slate-200">لا توجد طلبات بعد.</p>
              <p className="mt-2 text-sm text-slate-400">
                أنشئ طلبًا تجريبيًا ليظهر هنا.
              </p>
              <Button
                className="mt-4"
                render={<Link href="/sales/orders/new" />}
              >
                إنشاء أول طلب
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {orders.slice(0, 5).map((order) => {
                const customer = DEMO_CUSTOMERS.find(
                  (entry) => entry.id === order.customerId,
                );
                return (
                  <Link
                    key={order.id}
                    href={`/sales/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-sky-300" dir="ltr">
                        {order.number}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-white">
                        {customer?.name ?? "عميل غير معروف"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {order.product} · {numberFormatter.format(order.quantity)}{" "}
                        قطعة
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className={SALES_STATUS_CLASSES[order.status]}
                      >
                        {SALES_STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {dateFormatter.format(
                          new Date(`${order.expectedDeliveryDate}T12:00:00`),
                        )}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Link
            href="/sales/customers"
            className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 transition hover:border-sky-400/20"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <UsersRound aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">
                قائمة العملاء
              </span>
              <span className="mt-1 block text-sm text-slate-400">
                {numberFormatter.format(DEMO_CUSTOMERS.length)} عملاء تجريبيين
              </span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-4 text-slate-500" />
          </Link>
          <Link
            href="/sales/orders"
            className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 transition hover:border-sky-400/20"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
              <ClipboardList aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">
                استعراض الطلبات
              </span>
              <span className="mt-1 block text-sm text-slate-400">
                البحث والتصفية حسب الحالة
              </span>
            </span>
            <ArrowLeft aria-hidden="true" className="size-4 text-slate-500" />
          </Link>
        </div>
      </section>
    </main>
  );
}

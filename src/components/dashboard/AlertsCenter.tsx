import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpLeft,
  Boxes,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Clock3,
  Factory,
  ShoppingBag,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type OperationalAlert = {
  title: string;
  description: string;
  category: string;
  count: number;
  href: string;
  severity: "critical" | "warning" | "information";
};

const severityConfig = {
  critical: {
    label: "حرج",
    icon: AlertTriangle,
    className:
      "border-rose-400/20 bg-rose-400/[0.07] text-rose-300 ring-rose-400/10",
    dot: "bg-rose-400",
  },
  warning: {
    label: "تنبيه",
    icon: Clock3,
    className:
      "border-amber-400/20 bg-amber-400/[0.07] text-amber-300 ring-amber-400/10",
    dot: "bg-amber-400",
  },
  information: {
    label: "معلومات",
    icon: CircleHelp,
    className:
      "border-sky-400/20 bg-sky-400/[0.07] text-sky-300 ring-sky-400/10",
    dot: "bg-sky-400",
  },
} as const;

const categoryIcons: Record<string, LucideIcon> = {
  المخزون: Boxes,
  المشتريات: ShoppingCart,
  الإنتاج: Factory,
  المبيعات: ShoppingBag,
  التوزيع: Truck,
};

const severityOrder = {
  critical: 0,
  warning: 1,
  information: 2,
} as const;

const countFormatter = new Intl.NumberFormat("ar-DZ");

export function AlertsCenter({ alerts }: { alerts: OperationalAlert[] }) {
  const activeAlerts = alerts
    .filter((alert) => alert.count > 0)
    .sort(
      (left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity],
    );

  return (
    <section
      aria-labelledby="alerts-center-title"
      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/65 shadow-lg shadow-black/10"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-amber-300">
            OPERATIONAL PRIORITIES
          </p>
          <h2
            id="alerts-center-title"
            className="text-base font-semibold text-white sm:text-lg"
          >
            التنبيهات والإجراءات المطلوبة
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:text-sm">
            نقاط تشغيلية تتطلب المتابعة، مرتبة حسب مستوى الأهمية.
          </p>
        </div>
        {activeAlerts.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300">
            <span className="size-1.5 rounded-full bg-amber-400" />
            {countFormatter.format(activeAlerts.length)} تنبيهات نشطة
          </span>
        )}
      </header>

      {activeAlerts.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-4 text-sm font-medium text-slate-200">
            لا توجد إجراءات تشغيلية معلّقة
          </h3>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500">
            لا توجد حاليًا حالات مخزون أو طلبات أو شحنات تتطلب المتابعة ضمن
            الوحدات المتاحة لك.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {activeAlerts.map((alert) => {
            const severity = severityConfig[alert.severity];
            const CategoryIcon = categoryIcons[alert.category] ?? ClipboardList;
            const SeverityIcon = severity.icon;

            return (
              <li key={`${alert.category}-${alert.title}`}>
                <Link
                  href={alert.href}
                  className="group relative flex h-full min-h-40 flex-col rounded-2xl border border-white/[0.07] bg-slate-950/40 p-4 transition duration-200 hover:border-white/[0.15] hover:bg-slate-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl border ${severity.className}`}
                    >
                      <CategoryIcon
                        aria-hidden="true"
                        className="size-[18px]"
                      />
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${severity.className}`}
                    >
                      <span className={`size-1.5 rounded-full ${severity.dot}`} />
                      <SeverityIcon aria-hidden="true" className="size-3" />
                      {severity.label}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                    <CategoryIcon aria-hidden="true" className="size-3.5" />
                    <span>{alert.category}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-100">
                    {alert.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    {alert.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                    <span className="text-xs text-slate-500">سجلات متأثرة</span>
                    <span className="text-lg font-semibold tabular-nums text-white">
                      {countFormatter.format(alert.count)}
                    </span>
                  </div>
                  <ArrowUpLeft
                    aria-hidden="true"
                    className="absolute bottom-4 start-4 size-4 text-slate-600 transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-300"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

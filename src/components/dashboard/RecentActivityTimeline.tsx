import Link from "next/link";
import {
  ArrowUpLeft,
  ArrowLeft,
  Boxes,
  ClipboardList,
  Factory,
  ShoppingBag,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type TimelineActivity = {
  id: string;
  title: string;
  description: string;
  category: "المشتريات" | "المخزون" | "الإنتاج" | "المبيعات" | "التوزيع";
  reference: string | null;
  occurredAt: Date;
  href: string;
};

const categoryConfig: Record<
  TimelineActivity["category"],
  { icon: LucideIcon; className: string }
> = {
  المشتريات: {
    icon: ShoppingCart,
    className: "border-violet-400/15 bg-violet-400/[0.07] text-violet-300",
  },
  المخزون: {
    icon: Boxes,
    className: "border-amber-400/15 bg-amber-400/[0.07] text-amber-300",
  },
  الإنتاج: {
    icon: Factory,
    className: "border-blue-400/15 bg-blue-400/[0.07] text-blue-300",
  },
  المبيعات: {
    icon: ShoppingBag,
    className: "border-indigo-400/15 bg-indigo-400/[0.07] text-indigo-300",
  },
  التوزيع: {
    icon: Truck,
    className: "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300",
  },
};

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});

export function RecentActivityTimeline({
  activities,
  moduleLinks,
}: {
  activities: TimelineActivity[];
  moduleLinks: { label: string; href: string }[];
}) {
  return (
    <section
      aria-labelledby="recent-activity-title"
      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/65 shadow-lg shadow-black/10"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-sky-300">
            OPERATIONAL UPDATES
          </p>
          <h2
            id="recent-activity-title"
            className="text-base font-semibold text-white sm:text-lg"
          >
            النشاط الأخير
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:text-sm">
            أحدث التغييرات المسجلة عبر وحدات سلسلة التوريد.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          <span className="size-1.5 rounded-full bg-sky-400" />
          الأحدث أولًا
        </span>
      </header>

      {activities.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-2xl border border-sky-400/15 bg-sky-400/[0.06] text-sky-300">
            <ClipboardList aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-4 text-sm font-medium text-slate-200">
            لا يوجد نشاط حديث
          </h3>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500">
            ستظهر هنا العمليات المسجلة عند بدء النشاط في الوحدات المتاحة لك.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-white/[0.05]">
          {activities.map((activity) => {
            const { icon: Icon, className } =
              categoryConfig[activity.category];

            return (
              <li key={activity.id}>
                <Link
                  href={activity.href}
                  className="group flex gap-3 px-4 py-3.5 transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/50 sm:gap-4 sm:px-5"
                >
                  <span
                    className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-xl border ${className}`}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-slate-100">
                        {activity.title}
                      </span>
                      <span className="rounded-full border border-white/[0.06] bg-slate-950/60 px-2 py-0.5 text-[10px] text-slate-500">
                        {activity.category}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      {activity.description}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {activity.reference && (
                        <span className="font-medium text-slate-400" dir="auto">
                          {activity.reference}
                        </span>
                      )}
                      <time dateTime={activity.occurredAt.toISOString()}>
                        {dateFormatter.format(activity.occurredAt)}
                      </time>
                    </span>
                  </span>

                  <ArrowUpLeft
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-slate-600 transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-300"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {moduleLinks.length > 0 && (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] px-5 py-4 sm:px-6">
          <span className="text-[11px] text-slate-500">عرض سجلات الوحدات:</span>
          {moduleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 text-xs text-sky-300 transition hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
            >
              {link.label}
              <ArrowLeft aria-hidden="true" className="size-3" />
            </Link>
          ))}
        </footer>
      )}
    </section>
  );
}

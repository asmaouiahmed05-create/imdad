import Link from "next/link";
import { ArrowUpLeft, type LucideIcon } from "lucide-react";

type Accent = "blue" | "violet" | "amber" | "emerald" | "rose";

const accentClasses: Record<Accent, string> = {
  blue: "bg-sky-400/10 text-sky-300 ring-sky-400/15",
  violet: "bg-violet-400/10 text-violet-300 ring-violet-400/15",
  amber: "bg-amber-400/10 text-amber-300 ring-amber-400/15",
  emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/15",
  rose: "bg-rose-400/10 text-rose-300 ring-rose-400/15",
};

export type ExecutiveMetric = {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  accent: Accent;
};

export function ExecutiveMetricCard({
  label,
  value,
  href,
  icon: Icon,
  accent,
}: ExecutiveMetric) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-40 min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 shadow-md shadow-black/10 transition duration-200 hover:border-sky-300/20 hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${accentClasses[accent]}`}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
        </div>
        <ArrowUpLeft
          aria-hidden="true"
          className="size-4 text-slate-600 transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-300"
        />
      </div>
      <div className="mt-5">
        <p className="text-[1.7rem] font-semibold tracking-tight text-white tabular-nums sm:text-3xl">
          {value}
        </p>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-400">{label}</p>
      </div>
    </Link>
  );
}

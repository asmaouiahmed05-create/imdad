import type { LucideIcon } from "lucide-react";

type Accent = "rose" | "blue" | "violet" | "amber" | "emerald";

const accentClasses: Record<Accent, string> = {
  rose: "bg-rose-400/10 text-rose-300 ring-rose-400/15",
  blue: "bg-sky-400/10 text-sky-300 ring-sky-400/15",
  violet: "bg-violet-400/10 text-violet-300 ring-violet-400/15",
  amber: "bg-amber-400/10 text-amber-300 ring-amber-400/15",
  emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/15",
};

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: Accent;
};

export function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75 p-4 shadow-lg shadow-black/10 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${accentClasses[accent]}`}
        >
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <span className="mt-1 size-1.5 rounded-full bg-white/15" />
      </div>
      <p className="mt-5 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:text-sm">{label}</p>
    </article>
  );
}

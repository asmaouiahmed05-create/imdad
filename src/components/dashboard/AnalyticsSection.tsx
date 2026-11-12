"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Boxes, ChartNoAxesCombined } from "lucide-react";

export type AnalyticsPoint = {
  date: string;
  inbound?: number;
  outbound?: number;
  created?: number;
  received?: number;
  completed?: number;
  cancelled?: number;
  fulfilled?: number;
  delivered?: number;
  failed?: number;
};

export type AnalyticsStatus = {
  label: string;
  value: number;
  color: string;
};

export type AnalyticsModule = {
  key: string;
  title: string;
  description: string;
  trendLabel: string;
  data: AnalyticsPoint[];
  series: { key: keyof AnalyticsPoint; label: string; color: string }[];
  statuses: AnalyticsStatus[];
  chartType: "line" | "bar";
  href: string;
};

const numberFormatter = new Intl.NumberFormat("ar-DZ");
const periodOptions = [
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يومًا" },
  { value: "90d", label: "آخر 90 يومًا" },
  { value: "all", label: "كل الفترة" },
] as const;

const tooltipStyle = {
  direction: "rtl" as const,
  backgroundColor: "#0f172a",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "11px",
};

export function AnalyticsSection({
  period,
  modules,
  inventorySummary,
}: {
  period: (typeof periodOptions)[number]["value"];
  modules: AnalyticsModule[];
  inventorySummary: { lowStock: number; outOfStock: number; available: number } | null;
}) {
  return (
    <section
      id="analytics"
      aria-labelledby="analytics-title"
      className="space-y-4"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-sky-300">
            PERFORMANCE INSIGHTS
          </p>
          <h2
            id="analytics-title"
            className="text-base font-semibold text-white sm:text-lg"
          >
            التحليلات والأداء
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:text-sm">
            اتجاهات النشاط التشغيلي وتوزيع الحالات المسجلة.
          </p>
          {inventorySummary && (
            <p className="mt-1 text-[11px] text-slate-500">
              مؤشرات المخزون الحالية لقطة مباشرة؛ الرسوم البيانية تتبع الفترة المحددة.
            </p>
          )}
        </div>
        <nav
          aria-label="الفترة الزمنية للتحليلات"
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-slate-900/80 p-1"
        >
          {periodOptions.map((option) => (
            <Link
              key={option.value}
              href={`/?period=${option.value}#analytics`}
              aria-current={period === option.value ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 ${
                period === option.value
                  ? "bg-sky-400/10 font-medium text-sky-200"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </header>

      {inventorySummary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InventorySnapshot
            label="أصناف متوفرة"
            value={inventorySummary.available}
            tone="emerald"
          />
          <InventorySnapshot
            label="مخزون منخفض"
            value={inventorySummary.lowStock}
            tone="amber"
          />
          <InventorySnapshot
            label="نفد المخزون"
            value={inventorySummary.outOfStock}
            tone="rose"
          />
        </div>
      )}

      {modules.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-slate-900/60 px-6 py-10 text-center text-sm text-slate-500">
          لا تتوفر صلاحية لعرض تحليلات الوحدات.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {modules.map((module) => (
            <article
              key={module.key}
              className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/65 p-4 shadow-md shadow-black/10 sm:p-5"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {module.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {module.description}
                  </p>
                </div>
                <Link
                  href={module.href}
                  aria-label={`فتح وحدة ${module.title}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-slate-950/50 text-slate-400 transition hover:border-sky-300/20 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                >
                  <ChartNoAxesCombined aria-hidden="true" className="size-4" />
                </Link>
              </header>

              <div
                className="mt-4 h-52 min-w-0 sm:h-56"
                dir="ltr"
                aria-label={module.trendLabel}
              >
                {module.data.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] text-xs text-slate-500">
                    <Boxes aria-hidden="true" className="size-5 text-slate-600" />
                    لا توجد بيانات لهذه الفترة
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {module.chartType === "line" ? (
                      <LineChart
                        data={module.data}
                        margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="rgba(148,163,184,0.10)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={20}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={34}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => numberFormatter.format(Number(value))}
                          labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                        />
                        {module.series.map((series) => (
                          <Line
                            key={series.key}
                            type="monotone"
                            dataKey={series.key}
                            name={series.label}
                            stroke={series.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart
                        data={module.data}
                        margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="rgba(148,163,184,0.10)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={20}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={34}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => numberFormatter.format(Number(value))}
                          labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                        />
                        {module.series.map((series) => (
                          <Bar
                            key={series.key}
                            dataKey={series.key}
                            name={series.label}
                            fill={series.color}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={24}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

              {module.statuses.length > 0 && (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <p className="mb-2 text-[10px] font-medium text-slate-500">
                    توزيع الحالات ضمن الفترة
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="size-[76px] shrink-0" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={module.statuses}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={21}
                            outerRadius={35}
                            paddingAngle={2}
                            stroke="none"
                            isAnimationActive={false}
                          >
                            {module.statuses.map((status) => (
                              <Cell
                                key={status.label}
                                fill={status.color}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value) =>
                              numberFormatter.format(Number(value))
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {module.statuses.map((status) => (
                        <span
                          key={status.label}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-slate-950/40 px-2.5 py-1.5 text-[10px] text-slate-400"
                        >
                          <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.label}
                          <span className="font-semibold tabular-nums text-slate-200">
                            {numberFormatter.format(status.value)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InventorySnapshot({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClasses = {
    emerald: "bg-emerald-400/10 text-emerald-300",
    amber: "bg-amber-400/10 text-amber-300",
    rose: "bg-rose-400/10 text-rose-300",
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-900/60 px-4 py-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={`rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums ${toneClasses}`}
      >
        {numberFormatter.format(value)}
      </span>
    </div>
  );
}

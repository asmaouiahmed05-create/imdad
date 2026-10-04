"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopProductDatum } from "@/components/dashboard/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const numberFormatter = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 2,
});

type TopProductsChartProps = {
  data: TopProductDatum[];
};

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <Card className="min-w-0 rounded-2xl border-white/[0.07] bg-slate-900/75 py-5 text-slate-100 shadow-xl shadow-black/10">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 px-5 sm:px-6">
        <div>
          <CardTitle className="text-sm font-semibold text-white">
            أعلى الأصناف كمية
          </CardTitle>
          <CardDescription className="mt-1 text-xs text-slate-500">
            الأصناف مرتبة حسب الكمية المتاحة
          </CardDescription>
        </div>
        <span className="rounded-lg border border-white/[0.07] bg-slate-800/80 px-2.5 py-1 text-xs text-slate-400">
          أعلى {numberFormatter.format(data.length)}
        </span>
      </CardHeader>
      <CardContent className="px-4 pt-4 sm:px-5">
        {data.length > 0 ? (
          <div
            role="img"
            aria-label="مخطط أعلى الأصناف كمية"
            className="h-[260px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 12, bottom: 2, left: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="rgba(148,163,184,0.11)"
                  strokeDasharray="4 5"
                />
                <XAxis
                  type="number"
                  orientation="top"
                  reversed
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={(value: number) => numberFormatter.format(value)}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, "dataMax"]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  orientation="right"
                  width={100}
                  tick={{ fill: "#cbd5e1", fontSize: 11 }}
                  tickFormatter={(value: string) =>
                    value.length > 13 ? `${value.slice(0, 12)}…` : value
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.06)" }}
                  formatter={(value) => [
                    numberFormatter.format(Number(value)),
                    "الكمية",
                  ]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    direction: "rtl",
                    backgroundColor: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.18)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="quantity"
                  name="الكمية"
                  fill="#60a5fa"
                  radius={[6, 6, 6, 6]}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-500">
            لا توجد أصناف لعرضها
          </div>
        )}
      </CardContent>
    </Card>
  );
}

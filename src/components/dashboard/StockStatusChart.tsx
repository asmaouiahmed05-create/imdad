"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StockStatusDatum } from "@/components/dashboard/types";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const numberFormatter = new Intl.NumberFormat("ar-DZ");

type StockStatusChartProps = {
  data: StockStatusDatum[];
  total: number;
};

export function StockStatusChart({ data, total }: StockStatusChartProps) {
  return (
    <Card className="min-w-0 rounded-2xl border-white/[0.07] bg-slate-900/75 py-5 text-slate-100 shadow-xl shadow-black/10">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 px-5 sm:px-6">
        <div>
          <CardTitle className="text-sm font-semibold text-white">
            حالة المخزون
          </CardTitle>
          <CardDescription className="mt-1 text-xs text-slate-500">
            توزيع الأصناف حسب مستوى التوفر
          </CardDescription>
        </div>
        <span className="rounded-lg border border-white/[0.07] bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300">
          {numberFormatter.format(total)} صنف
        </span>
      </CardHeader>
      <CardContent className="px-5 pt-2 sm:px-6">
        <div className="flex min-h-[248px] flex-col items-center justify-center gap-2 sm:flex-row sm:gap-5">
          <div className="relative h-[230px] w-full max-w-[250px] shrink-0">
            {total > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="64%"
                      outerRadius="82%"
                      paddingAngle={3}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {data.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => numberFormatter.format(Number(value))}
                      contentStyle={{
                        direction: "rtl",
                        backgroundColor: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "12px",
                        color: "#e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold tabular-nums text-white">
                    {numberFormatter.format(total)}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">إجمالي الأصناف</span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-full border border-dashed border-slate-700 text-xs text-slate-500">
                لا توجد بيانات لعرضها
              </div>
            )}
          </div>

          <ul className="grid w-full max-w-[230px] gap-3">
            {data.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2.5 text-slate-400">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-medium tabular-nums text-slate-200">
                  {numberFormatter.format(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

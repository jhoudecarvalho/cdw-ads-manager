"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Series = {
  key: string;
  label: string;
  color: string;
};

type Row = Record<string, string | number> & { date: string };

type Props = {
  data: Row[];
  series: Series[];
};

export function LineTrendChart({ data, series }: Props) {
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => v.slice(5)}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()
          }
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

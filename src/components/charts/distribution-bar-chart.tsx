"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Row = { label: string; value: number };

type Props = {
  data: Row[];
  valueLabel: string;
  color?: string;
};

/**
 * Bar chart horizontal-feel (rotacionado mentalmente): eixos X=label,
 * Y=value. Para "distribuição por X" — tipo, objetivo, região.
 */
export function DistributionBarChart({
  data,
  valueLabel,
  color = "var(--chart-1)",
}: Props) {
  const config = {
    value: { label: valueLabel, color },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          interval={0}
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
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

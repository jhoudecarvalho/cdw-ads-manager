"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  date: string;
  google: number;
  meta: number;
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-alt)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 11,
    color: "var(--text)",
  },
  labelStyle: { color: "var(--text-muted)" },
};

/**
 * Bar chart de conversões diárias separando Google × Meta lado a lado.
 * Cores da plataforma vêm dos tokens do design.
 */
export function ConversionBars({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          stroke="var(--text-muted)"
          fontSize={10}
          tickFormatter={(v: string) => (v.length === 10 ? v.slice(5) : v)}
        />
        <YAxis stroke="var(--text-muted)" fontSize={10} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="google"
          name="Google"
          fill="var(--google)"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="meta"
          name="Meta"
          fill="var(--meta)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

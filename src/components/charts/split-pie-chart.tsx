"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = {
  name: string;
  value: number;
  color: string;
};

type Props = {
  data: Slice[];
  /** Preset de formatação do tooltip. Funções não atravessam a fronteira
   *  server → client, então usamos enum string. */
  format?: "currency" | "int";
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
 * Donut chart usado pelo split Google × Meta. Labels na borda externa,
 * inner radius pra não parecer pizza cheia.
 */
export function SplitPieChart({ data, format = "int" }: Props) {
  const fmt = (n: number) =>
    format === "currency"
      ? n.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : n.toLocaleString("pt-BR");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={4}
          dataKey="value"
          label={(p) => {
            const idx = (p as { index?: number }).index ?? 0;
            const slice = data[idx];
            const percent = (p as { percent?: number }).percent ?? 0;
            return slice ? `${slice.name} ${(percent * 100).toFixed(0)}%` : "";
          }}
          labelLine={false}
          style={{ fontSize: 10 }}
        >
          {data.map((s, i) => (
            <Cell key={i} fill={s.color} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v) || 0)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * AreaChart com gradient fills — estilo direto do design.
 *
 * Usa Recharts puro (não o wrapper shadcn) para controle fino do gradient
 * definido em SVG `<defs>`. Cada série traz a própria cor.
 */

type Series = {
  key: string;
  label: string;
  color: string;
};

type Row = Record<string, string | number> & { date: string };

type Props = {
  data: Row[];
  series: Series[];
  formatY?: "currency-k" | "k" | "default";
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

function tickFmt(mode: Props["formatY"]) {
  return (v: number) => {
    if (mode === "currency-k")
      return v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`;
    if (mode === "k")
      return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
    return String(v);
  };
}

export function AreaTrendChart({ data, series, formatY = "k" }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.key}
              id={`grad-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          stroke="var(--text-muted)"
          fontSize={10}
          tickFormatter={(v: string) => (v.length === 10 ? v.slice(5) : v)}
        />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={10}
          tickFormatter={tickFmt(formatY)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => {
            const n = Number(v) || 0;
            return formatY === "currency-k"
              ? n.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })
              : n.toLocaleString("pt-BR");
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            fill={`url(#grad-${s.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

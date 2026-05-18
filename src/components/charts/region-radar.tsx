"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Row = {
  region: string;
  conversions: number;
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
 * Radar de performance por região — usado na Visão Geral e na tela
 * Regiões. Visualiza rapidamente quais regiões puxam mais conversões.
 */
export function RegionRadar({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="region"
          stroke="var(--text-muted)"
          fontSize={10}
        />
        <PolarRadiusAxis stroke="var(--border)" fontSize={9} />
        <Radar
          name="Conversões"
          dataKey="conversions"
          stroke="var(--accent)"
          fill="var(--accent)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Tooltip {...tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

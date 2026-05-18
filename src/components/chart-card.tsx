type Props = {
  title: string;
  /** Altura interna do gráfico. Default 280. */
  height?: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * Wrapper de chart no estilo do design — surface, border sutil, title bold
 * Space Grotesk, altura interna controlada para ResponsiveContainer do
 * Recharts.
 */
export function ChartCard({ title, height = 280, children, className }: Props) {
  return (
    <div
      className={`rounded-[14px] border border-border bg-surface p-5 ${className ?? ""}`}
    >
      <div className="mb-3 text-[13px] font-bold text-text">{title}</div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

import type { CSSProperties } from "react";

type Props = {
  label: string;
  value: string;
  /** Emoji que vira watermark grande no canto (opacidade baixa). */
  icon?: string;
  /** Cor opcional do valor — tipicamente var(--accent/google/meta/etc). */
  color?: string;
  /** Texto pequeno abaixo do valor (ex.: "12 campanhas"). */
  subValue?: string;
  /** Alias para subValue — mantido por compat com KpiCard antigo. */
  hint?: string;
};

/**
 * KPI card no estilo do design Franchise HUB:
 *   - Background gradiente surface → surface-alt
 *   - Emoji watermark gigante no canto top-right (6% opacidade)
 *   - Label em uppercase mono pequeno
 *   - Valor BIG bold (Space Grotesk)
 *   - Cor configurável do valor para destacar plataforma/estado
 */
export function KpiCard({ label, value, icon, color, subValue, hint }: Props) {
  const valueStyle: CSSProperties = color ? { color } : {};
  const sub = subValue ?? hint;
  return (
    <div
      className="relative overflow-hidden rounded-[14px] border border-border p-[18px_20px]"
      style={{
        background:
          "linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%)",
      }}
    >
      {icon && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-2 select-none text-[48px]"
          style={{ opacity: 0.06 }}
        >
          {icon}
        </div>
      )}
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[1.2px] text-text-muted">
        {label}
      </div>
      <div
        className="text-2xl font-extrabold leading-none tabular-nums text-text"
        style={valueStyle}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-text-muted">{sub}</div>}
    </div>
  );
}

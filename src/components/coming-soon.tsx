type Props = {
  title: string;
  description: string;
  icon?: string;
  phase?: string;
};

/**
 * "Em desenvolvimento" estilizado conforme design — ícone gigante centro,
 * título, descrição e badge "🚧 Em desenvolvimento".
 *
 * Usado nos 4 módulos BREVE (Ecocentauro, Indicação, Sellflux, Landing) e
 * em telas Fase 6 ainda não preenchidas.
 */
export function ComingSoon({
  title,
  description,
  icon = "🚧",
  phase = "Em breve",
}: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div
        aria-hidden
        className="mb-6 text-[88px] leading-none"
        style={{ filter: "drop-shadow(0 0 24px rgba(34, 211, 238, 0.25))" }}
      >
        {icon}
      </div>
      <h1 className="text-2xl font-extrabold text-text">{title}</h1>
      <p className="mt-3 max-w-xl text-sm text-text-muted">{description}</p>
      <div
        className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider"
        style={{
          background: "rgba(251, 191, 36, 0.10)",
          borderColor: "rgba(251, 191, 36, 0.35)",
          color: "var(--warning)",
        }}
      >
        🚧 {phase}
      </div>
    </div>
  );
}

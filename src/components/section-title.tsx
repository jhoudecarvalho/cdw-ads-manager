type Props = {
  children: React.ReactNode;
  sub?: string;
};

/**
 * Cabeçalho de seção interno (não confundir com DashboardHeader, que é o
 * topo da página). Usado dentro das telas para introduzir gráficos/tabelas.
 */
export function SectionTitle({ children, sub }: Props) {
  return (
    <div className="mb-4 mt-2">
      <h3 className="m-0 text-base font-extrabold text-text">{children}</h3>
      {sub && <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}

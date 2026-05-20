import { ApiInfoFooter } from "@/components/api-info-footer";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { ChartCard } from "@/components/chart-card";
import { KpiCard } from "@/components/kpi-card";
import { brl, pct } from "@/lib/format";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
import { loadFinancial } from "@/server/metrics/financial";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function FinanceiroPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  const filters = parseDashboardFilters(sp);
  const data = await loadFinancial(actor.tenantId, actor, filters);

  const profitColor =
    data.grossProfit >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {data.rangeDays} dias
        </p>
        <h1 className="mt-1 text-xl font-extrabold">💰 Financeiro</h1>
      </div>

      <div className="grid auto-rows-fr gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <KpiCard
          label="Custo Total"
          value={brl(data.cost)}
          icon="💸"
          color="var(--danger)"
        />
        <KpiCard
          label="Receita Total"
          value={brl(data.revenue)}
          icon="📈"
          color="var(--success)"
        />
        <KpiCard
          label="Lucro Bruto"
          value={brl(data.grossProfit)}
          icon={data.grossProfit >= 0 ? "🟢" : "🔴"}
          color={profitColor}
          subValue={data.grossProfit >= 0 ? "positivo" : "negativo"}
        />
        <KpiCard
          label="Margem"
          value={pct(data.margin, 1)}
          icon="📊"
          color={profitColor}
        />
        <KpiCard
          label="Custo / Dia"
          value={brl(data.avgDailyCost)}
          icon="💳"
          color="var(--meta-light)"
        />
        <KpiCard
          label="Receita / Dia"
          value={brl(data.avgDailyRevenue)}
          icon="💎"
          color="var(--warning)"
        />
      </div>

      <ChartCard
        title="📈 Investimento × Receita × Lucro — diário"
        height={300}
      >
        {data.byDay.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            Sem dados.
          </div>
        ) : (
          <AreaTrendChart
            data={data.byDay}
            formatY="currency-k"
            series={[
              { key: "cost", label: "Custo", color: "var(--danger)" },
              { key: "revenue", label: "Receita", color: "var(--success)" },
              { key: "profit", label: "Lucro", color: "var(--accent)" },
            ]}
          />
        )}
      </ChartCard>

      <ApiInfoFooter />
    </div>
  );
}

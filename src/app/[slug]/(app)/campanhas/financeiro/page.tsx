import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { KpiCard } from "@/components/kpi-card";
import { LineTrendChart } from "@/components/charts/line-trend-chart";
import { brl, pct } from "@/lib/format";
import { parseDashboardFilters } from "@/lib/filters";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadFinancial } from "@/server/metrics/financial";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function FinanceiroPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const data = await loadFinancial(actor.tenantId, actor, filters);

  const profitColor =
    data.grossProfit >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Financeiro"
        subtitle={`${slug} · últimos ${data.rangeDays} dias`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Custo total" value={brl(data.cost)} />
        <KpiCard label="Receita total" value={brl(data.revenue)} />
        <KpiCard
          label="Lucro bruto"
          value={brl(data.grossProfit)}
          hint={data.grossProfit >= 0 ? "positivo" : "negativo"}
        />
        <KpiCard label="Margem" value={pct(data.margin, 1)} />
        <KpiCard label="Custo/dia" value={brl(data.avgDailyCost)} />
        <KpiCard label="Receita/dia" value={brl(data.avgDailyRevenue)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Investimento × Receita × Lucro diário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byDay.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem dados.
            </p>
          ) : (
            <LineTrendChart
              data={data.byDay}
              series={[
                { key: "cost", label: "Custo", color: "var(--chart-2)" },
                { key: "revenue", label: "Receita", color: "var(--chart-1)" },
                { key: "profit", label: "Lucro", color: "var(--chart-3)" },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
            <Row label="Custo total" value={brl(data.cost)} />
            <Row label="Receita total" value={brl(data.revenue)} />
            <Row
              label="Lucro bruto"
              value={brl(data.grossProfit)}
              className={profitColor}
            />
            <Row
              label="Margem bruta"
              value={pct(data.margin, 1)}
              className={profitColor}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-base font-semibold tabular-nums ${className ?? ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

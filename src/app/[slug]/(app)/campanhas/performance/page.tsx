import { ApiInfoFooter } from "@/components/api-info-footer";
import { ChartCard } from "@/components/chart-card";
import { KpiCard } from "@/components/kpi-card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, int, multiplier, pct } from "@/lib/format";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
import { loadPerformance } from "@/server/metrics/performance";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PerformancePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  const filters = parseDashboardFilters(sp);
  const data = await loadPerformance(actor.tenantId, actor, filters);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {data.rangeDays} dias
        </p>
        <h1 className="mt-1 text-xl font-extrabold">⚡ Performance</h1>
      </div>

      <div className="grid auto-rows-fr gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <KpiCard
          label="Taxa Conversão"
          value={pct(data.conversionRate)}
          icon="🎯"
          color="var(--success)"
        />
        <KpiCard
          label="Receita / Clique"
          value={brl(data.revenuePerClick, 2)}
          icon="💎"
          color="var(--warning)"
        />
        <KpiCard
          label="Custo / Clique"
          value={brl(data.costPerClick, 2)}
          icon="💳"
          color="var(--meta-light)"
        />
        <KpiCard
          label="Custo / Conversão"
          value={brl(data.costPerConversion)}
          icon="🏷"
          color="var(--danger)"
        />
        <KpiCard
          label="CTR"
          value={pct(data.ctr)}
          icon="📊"
          color="var(--accent)"
        />
        <KpiCard
          label="CPM"
          value={brl(data.cpm, 2)}
          icon="📢"
          color="var(--accent-alt)"
        />
      </div>

      <ChartCard
        title="📊 Distribuição de investimento por tipo de campanha"
        height={undefined as unknown as number}
      >
        {data.distributionByType.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-3">
            {data.distributionByType.map((d) => (
              <div key={d.type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{d.type}</span>
                  <span className="tabular-nums text-text-muted">
                    {brl(d.spend)} · {pct(d.share, 1)} · {int(d.conversions)}{" "}
                    conv. · {multiplier(d.spend > 0 ? d.revenue / d.spend : 0)}
                  </span>
                </div>
                <Progress value={d.share} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="📋 Resumo por tipo"
        height={undefined as unknown as number}
      >
        {data.distributionByType.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase">
                  Tipo
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Invest.
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Conv.
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Receita
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Share
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  ROAS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.distributionByType.map((d) => (
                <TableRow key={d.type}>
                  <TableCell className="font-medium">{d.type}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(d.spend)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {int(d.conversions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(d.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pct(d.share, 1)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {multiplier(d.spend > 0 ? d.revenue / d.spend : 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ChartCard>

      <ApiInfoFooter />
    </div>
  );
}

function Empty() {
  return <div className="py-4 text-sm text-text-muted">Sem dados.</div>;
}

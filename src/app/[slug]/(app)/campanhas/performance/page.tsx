import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
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
import { loadActorContext } from "@/server/auth/load-actor";
import { loadPerformance } from "@/server/metrics/performance";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PerformancePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const data = await loadPerformance(actor.tenantId, actor, filters);

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Performance"
        subtitle={`${slug} · últimos ${data.rangeDays} dias`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Taxa conversão" value={pct(data.conversionRate)} />
        <KpiCard
          label="Receita / clique"
          value={brl(data.revenuePerClick, 2)}
        />
        <KpiCard label="Custo / clique" value={brl(data.costPerClick, 2)} />
        <KpiCard
          label="Custo / conversão"
          value={brl(data.costPerConversion)}
        />
        <KpiCard label="CTR" value={pct(data.ctr)} />
        <KpiCard label="CPM" value={brl(data.cpm, 2)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Distribuição de investimento por tipo de campanha
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.distributionByType.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-4">
              {data.distributionByType.map((d) => (
                <div key={d.type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{d.type}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {brl(d.spend)} · {pct(d.share, 1)} · {int(d.conversions)}{" "}
                      conv. ·{" "}
                      {multiplier(d.spend > 0 ? d.revenue / d.spend : 0)}
                    </span>
                  </div>
                  <Progress value={d.share} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por tipo</CardTitle>
        </CardHeader>
        <CardContent>
          {data.distributionByType.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
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
                    <TableCell className="text-right tabular-nums font-semibold">
                      {multiplier(d.spend > 0 ? d.revenue / d.spend : 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

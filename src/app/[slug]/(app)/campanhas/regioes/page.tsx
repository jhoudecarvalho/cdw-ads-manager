import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { DistributionBarChart } from "@/components/charts/distribution-bar-chart";
import { KpiCard } from "@/components/kpi-card";
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
import { loadRegionSummary } from "@/server/metrics/region-summary";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function RegioesPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const regions = await loadRegionSummary(actor.tenantId, actor, filters);

  const totalSpend = regions.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = regions.reduce((s, r) => s + r.revenue, 0);
  const totalConv = regions.reduce((s, r) => s + r.conversions, 0);
  const totalFranchises = regions.reduce((s, r) => s + r.franchiseCount, 0);

  // Ordena por receita para a tabela; bar chart usa a mesma ordem.
  const sorted = [...regions].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Regiões"
        subtitle={`${slug} · últimos ${filters.rangeDays ?? 14} dias`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Regiões"
          value={regions.length.toLocaleString("pt-BR")}
        />
        <KpiCard label="Franquias" value={int(totalFranchises)} />
        <KpiCard label="Investimento" value={brl(totalSpend)} />
        <KpiCard
          label="ROAS médio"
          value={multiplier(totalSpend > 0 ? totalRevenue / totalSpend : 0)}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investimento por região</CardTitle>
          </CardHeader>
          <CardContent>
            {sorted.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem dados.
              </p>
            ) : (
              <DistributionBarChart
                data={sorted.map((r) => ({ label: r.name, value: r.spend }))}
                valueLabel="Investimento"
                color="var(--chart-2)"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por região</CardTitle>
          </CardHeader>
          <CardContent>
            {sorted.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem dados.
              </p>
            ) : (
              <DistributionBarChart
                data={sorted.map((r) => ({ label: r.name, value: r.revenue }))}
                valueLabel="Receita"
                color="var(--chart-1)"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo por região</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Região</TableHead>
                  <TableHead className="text-right">Franquias</TableHead>
                  <TableHead className="text-right">Invest.</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Share do total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.regionId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.franchiseCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(r.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(r.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {multiplier(r.roas)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {int(r.conversions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(r.ctr)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct(
                        totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0,
                        1,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totalFranchises}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {brl(totalSpend)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {brl(totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {multiplier(totalSpend > 0 ? totalRevenue / totalSpend : 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {int(totalConv)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

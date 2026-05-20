import { notFound } from "next/navigation";
import { ApiInfoFooter } from "@/components/api-info-footer";
import { ChartCard } from "@/components/chart-card";
import { RegionRadar } from "@/components/charts/region-radar";
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
import { requireActor } from "@/server/auth/require-actor";
import { loadRegionSummary } from "@/server/metrics/region-summary";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function RegioesPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  // Página exclusiva do modo FRANCHISE — em COMPANY não há Region.
  if (actor.tenantType !== "FRANCHISE") notFound();
  const filters = parseDashboardFilters(sp);
  const regions = await loadRegionSummary(actor.tenantId, actor, filters);

  const totalSpend = regions.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = regions.reduce((s, r) => s + r.revenue, 0);
  const totalConv = regions.reduce((s, r) => s + r.conversions, 0);
  const totalFranchises = regions.reduce((s, r) => s + r.franchiseCount, 0);
  const sorted = [...regions].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {filters.rangeDays ?? 14} dias
        </p>
        <h1 className="mt-1 text-xl font-extrabold">🗺️ Regiões</h1>
      </div>

      <div className="grid auto-rows-fr gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <KpiCard
          label="Regiões"
          value={int(regions.length)}
          icon="🗺️"
          color="var(--accent)"
        />
        <KpiCard
          label="Franquias"
          value={int(totalFranchises)}
          icon="🏪"
          color="var(--accent-alt)"
        />
        <KpiCard
          label="Investimento"
          value={brl(totalSpend)}
          icon="💰"
          color="var(--google)"
        />
        <KpiCard
          label="ROAS Médio"
          value={multiplier(totalSpend > 0 ? totalRevenue / totalSpend : 0)}
          icon="⚡"
          color="var(--warning)"
        />
      </div>

      <ChartCard title="📡 Performance por região (conversões)" height={300}>
        {sorted.length === 0 ? (
          <Empty />
        ) : (
          <RegionRadar
            data={sorted.map((r) => ({
              region: r.name,
              conversions: r.conversions,
            }))}
          />
        )}
      </ChartCard>

      <ChartCard
        title="📊 Comparativo por região"
        height={undefined as unknown as number}
      >
        {sorted.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase">
                  Região
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Franquias
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Invest.
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Receita
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  ROAS
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Conv.
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  CTR
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">
                  Share
                </TableHead>
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
                  <TableCell className="text-right font-bold tabular-nums text-accent">
                    {multiplier(r.roas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {int(r.conversions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pct(r.ctr)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-text-muted">
                    {pct(totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0, 1)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow style={{ background: "rgba(255,255,255,0.03)" }}>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {totalFranchises}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {brl(totalSpend)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {brl(totalRevenue)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {multiplier(totalSpend > 0 ? totalRevenue / totalSpend : 0)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {int(totalConv)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </ChartCard>

      <ApiInfoFooter />
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center py-12 text-sm text-text-muted">
      Sem dados.
    </div>
  );
}

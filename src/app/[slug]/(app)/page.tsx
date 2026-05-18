import { auth } from "@/auth";
import { ApiInfoFooter } from "@/components/api-info-footer";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { ConversionBars } from "@/components/charts/conversion-bars";
import { RegionRadar } from "@/components/charts/region-radar";
import { SplitPieChart } from "@/components/charts/split-pie-chart";
import { ChartCard } from "@/components/chart-card";
import { KpiCard } from "@/components/kpi-card";
import { SyncButton } from "@/components/sync-button";
import { brl, int, multiplier, pct } from "@/lib/format";
import { parseDashboardFilters } from "@/lib/filters";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadOverview } from "@/server/metrics/dashboard";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function VisaoGeralPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const data = await loadOverview(actor.tenantId, actor, filters);
  const t = data.totals;

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
            {slug} · últimos {data.rangeDays} dias
          </p>
          <h1 className="mt-1 text-xl font-extrabold">📊 Visão Geral</h1>
        </div>
        {actor.role === "ADMIN" && <SyncButton tenantSlug={slug} />}
      </div>

      {/* KPI grid — 12 cards no estilo do design */}
      <div className="grid auto-rows-fr gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <KpiCard
          label="Investimento Total"
          value={brl(t.spend)}
          icon="💰"
          color="var(--accent)"
          subValue={`${int(t.totalCampaigns)} campanhas`}
        />
        <KpiCard
          label="Impressões"
          value={int(t.impressions)}
          icon="👁"
          color="var(--accent-alt)"
        />
        <KpiCard
          label="Cliques"
          value={int(t.clicks)}
          icon="🖱"
          color="var(--google)"
        />
        <KpiCard
          label="Conversões"
          value={int(t.conversions)}
          icon="🎯"
          color="var(--success)"
        />
        <KpiCard
          label="Receita Ads"
          value={brl(t.revenue)}
          icon="📈"
          color="var(--warning)"
        />
        <KpiCard
          label="ROAS Geral"
          value={multiplier(t.roas)}
          icon="⚡"
          color={t.roas >= 3 ? "var(--success)" : "var(--warning)"}
        />
        <KpiCard
          label="CTR Médio"
          value={pct(t.ctr)}
          icon="📊"
          color="var(--accent)"
        />
        <KpiCard
          label="CPC Médio"
          value={brl(t.cpc, 2)}
          icon="💳"
          color="var(--meta-light)"
        />
        <KpiCard
          label="CPM Médio"
          value={brl(t.cpm, 2)}
          icon="📢"
          color="var(--accent-alt)"
        />
        <KpiCard
          label="Custo / Conv."
          value={brl(t.costPerConversion)}
          icon="🏷"
          color="var(--danger)"
        />
        <KpiCard
          label="Alcance"
          value={int(t.reach)}
          icon="🌐"
          color="var(--google)"
        />
        <KpiCard
          label="Campanhas Ativas"
          value={int(t.activeCampaigns)}
          icon="🔄"
          subValue={`de ${int(t.totalCampaigns)} totais`}
        />
      </div>

      {/* Row 1: AreaChart 30 dias + Pie split */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ChartCard title="📈 Investimento Diário" height={260}>
          {data.byDay.length === 0 ? (
            <Empty />
          ) : (
            <AreaTrendChart
              data={data.byDay}
              formatY="currency-k"
              series={[
                {
                  key: "googleSpend",
                  label: "Google Ads",
                  color: "var(--google)",
                },
                { key: "metaSpend", label: "Meta Ads", color: "var(--meta)" },
              ]}
            />
          )}
        </ChartCard>

        <ChartCard title="💰 Split Investimento" height={260}>
          {data.byPlatform.length === 0 ? (
            <Empty />
          ) : (
            <SplitPieChart
              data={data.byPlatform.map((p) => ({
                name: p.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads",
                value: p.spend,
                color:
                  p.platform === "GOOGLE_ADS" ? "var(--google)" : "var(--meta)",
              }))}
              format="currency"
            />
          )}
        </ChartCard>
      </div>

      {/* Row 2: Conversões diárias + Radar regiões */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="🎯 Conversões Diárias" height={220}>
          {data.byDay.length === 0 ? (
            <Empty />
          ) : (
            <ConversionBars
              data={data.byDay.map((d) => ({
                date: d.date,
                google: d.googleConv,
                meta: d.metaConv,
              }))}
            />
          )}
        </ChartCard>

        <ChartCard title="🗺️ Performance por Região" height={220}>
          {data.byRegion.length === 0 ? (
            <Empty />
          ) : (
            <RegionRadar data={data.byRegion} />
          )}
        </ChartCard>
      </div>

      <ApiInfoFooter />
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-muted">
      Sem dados para os filtros atuais.
    </div>
  );
}

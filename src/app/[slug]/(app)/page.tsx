import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { OverviewChart } from "@/components/overview-chart";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadOverview } from "@/server/metrics/dashboard";
import type { Platform } from "@/generated/prisma/client";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    platform?: string;
    region?: string;
    franchise?: string;
  }>;
};

const PLATFORMS = new Set<Platform>(["GOOGLE_ADS", "META_ADS"]);

export default async function VisaoGeralPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);

  const platform =
    sp.platform && PLATFORMS.has(sp.platform as Platform)
      ? (sp.platform as Platform)
      : null;
  const filters = {
    platform,
    regionId: sp.region ?? null,
    franchiseId: sp.franchise ?? null,
  };

  const data = await loadOverview(actor.tenantId, actor, filters);
  const t = data.totals;

  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {slug} · últimos {data.rangeDays} dias
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Visão Geral</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Investimento" value={brl(t.spend)} />
        <KpiCard label="Receita" value={brl(t.revenue)} />
        <KpiCard label="ROAS" value={`${t.roas.toFixed(2)}x`} />
        <KpiCard label="Conversões" value={num0(t.conversions)} />
        <KpiCard label="Custo / Conv." value={brl(t.costPerConversion)} />
        <KpiCard label="Impressões" value={num0(t.impressions)} />
        <KpiCard label="Cliques" value={num0(t.clicks)} />
        <KpiCard label="CTR" value={`${t.ctr.toFixed(2)}%`} />
        <KpiCard label="CPC" value={brl(t.cpc)} />
        <KpiCard label="CPM" value={brl(t.cpm)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Investimento vs Receita — últimos {data.rangeDays} dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byDay.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem dados para os filtros atuais.
            </p>
          ) : (
            <OverviewChart data={data.byDay} />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-2">
        {data.byPlatform.map((p) => (
          <Card key={p.platform}>
            <CardHeader>
              <CardTitle className="text-base">
                {p.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Investimento" value={brl(p.spend)} />
                <Stat label="Receita" value={brl(p.revenue)} />
                <Stat
                  label="ROAS"
                  value={`${p.spend > 0 ? (p.revenue / p.spend).toFixed(2) : "0.00"}x`}
                />
                <Stat
                  label="Share"
                  value={`${
                    t.spend > 0 ? ((p.spend / t.spend) * 100).toFixed(0) : 0
                  }%`}
                />
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function num0(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

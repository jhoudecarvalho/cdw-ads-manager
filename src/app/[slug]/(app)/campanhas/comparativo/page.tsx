import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { brl, int, multiplier, pct } from "@/lib/format";
import { parseDashboardFilters } from "@/lib/filters";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadComparison } from "@/server/metrics/comparison";
import type { PlatformSlice } from "@/server/metrics/by-platform";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ComparativoPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const data = await loadComparison(actor.tenantId, actor, filters);

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Comparativo Google Ads × Meta Ads"
        subtitle={`${slug} · últimos ${data.rangeDays} dias`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformColumn
          title="Google Ads"
          color="border-blue-700/40"
          data={data.google}
          other={data.meta.totals}
        />
        <PlatformColumn
          title="Meta Ads"
          color="border-pink-700/40"
          data={data.meta}
          other={data.google.totals}
        />
      </div>
    </div>
  );
}

function PlatformColumn({
  title,
  color,
  data,
  other,
}: {
  title: string;
  color: string;
  data: PlatformSlice;
  other: PlatformSlice["totals"];
}) {
  const rows: Array<{
    label: string;
    mine: string;
    theirs: string;
    delta?: string;
  }> = [
    {
      label: "Investimento",
      mine: brl(data.totals.spend),
      theirs: brl(other.spend),
      delta: deltaPct(data.totals.spend, other.spend),
    },
    {
      label: "Receita",
      mine: brl(data.totals.revenue),
      theirs: brl(other.revenue),
      delta: deltaPct(data.totals.revenue, other.revenue),
    },
    {
      label: "ROAS",
      mine: multiplier(data.totals.roas),
      theirs: multiplier(other.roas),
      delta: deltaPct(data.totals.roas, other.roas),
    },
    {
      label: "Conversões",
      mine: int(data.totals.conversions),
      theirs: int(other.conversions),
    },
    {
      label: "Cliques",
      mine: int(data.totals.clicks),
      theirs: int(other.clicks),
    },
    {
      label: "CTR",
      mine: pct(data.totals.ctr),
      theirs: pct(other.ctr),
    },
    {
      label: "CPC",
      mine: brl(data.totals.cpc, 2),
      theirs: brl(other.cpc, 2),
    },
  ];

  return (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between border-b border-border/50 pb-2 last:border-0"
            >
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                {r.label}
              </dt>
              <dd className="text-right">
                <div className="text-base font-semibold tabular-nums">
                  {r.mine}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  vs {r.theirs}
                  {r.delta && (
                    <span
                      className={
                        r.delta.startsWith("+")
                          ? " text-emerald-400"
                          : r.delta.startsWith("-")
                            ? " text-red-400"
                            : ""
                      }
                    >
                      {" "}
                      ({r.delta})
                    </span>
                  )}
                </div>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function deltaPct(mine: number, theirs: number): string {
  if (theirs === 0) return mine > 0 ? "+∞" : "0%";
  const d = ((mine - theirs) / theirs) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

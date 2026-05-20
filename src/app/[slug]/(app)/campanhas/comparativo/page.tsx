import { ApiInfoFooter } from "@/components/api-info-footer";
import { brl, int, multiplier, pct } from "@/lib/format";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
import { loadComparison } from "@/server/metrics/comparison";
import type { PlatformSlice } from "@/server/metrics/by-platform";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ComparativoPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  const filters = parseDashboardFilters(sp);
  const data = await loadComparison(actor.tenantId, actor, filters);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {data.rangeDays} dias
        </p>
        <h1 className="mt-1 text-xl font-extrabold">
          ⚖️ Comparativo Google × Meta
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformColumn
          title="🔍 Google Ads"
          accent="var(--google)"
          data={data.google}
          other={data.meta.totals}
        />
        <PlatformColumn
          title="📱 Meta Ads"
          accent="var(--meta)"
          data={data.meta}
          other={data.google.totals}
        />
      </div>

      <ApiInfoFooter />
    </div>
  );
}

function PlatformColumn({
  title,
  accent,
  data,
  other,
}: {
  title: string;
  accent: string;
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
    <div
      className="rounded-[14px] border border-border bg-surface p-5"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div
        className="mb-4 text-[14px] font-extrabold"
        style={{ color: accent }}
      >
        {title}
      </div>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between border-b border-border/40 pb-2 last:border-0"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[1.2px] text-text-muted">
              {r.label}
            </dt>
            <dd className="text-right">
              <div className="text-base font-extrabold tabular-nums text-text">
                {r.mine}
              </div>
              <div className="text-[10px] tabular-nums text-text-muted">
                vs {r.theirs}
                {r.delta && (
                  <span
                    style={{
                      color: r.delta.startsWith("+")
                        ? "var(--success)"
                        : r.delta.startsWith("-")
                          ? "var(--danger)"
                          : undefined,
                    }}
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
    </div>
  );
}

function deltaPct(mine: number, theirs: number): string {
  if (theirs === 0) return mine > 0 ? "+∞" : "0%";
  const d = ((mine - theirs) / theirs) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

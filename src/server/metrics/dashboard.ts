import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform, Prisma } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";

/**
 * Helpers para queries do dashboard. Todas passam por `withTenantScope` — RLS
 * enforça o isolamento por tenant. Os filtros aqui em cima são REFINOS dentro
 * do tenant, não substitutos do isolamento.
 *
 * As permissões por papel (REGIONAL vê só suas regiões, FRANCHISEE só sua
 * franquia) entram via `applyActorScope` — se o ator pedir filtro por uma
 * região fora do escopo, ela é simplesmente ignorada.
 */

export type DashboardFilters = {
  platform: Platform | null;
  regionId: string | null;
  franchiseId: string | null;
  /** Janela em dias para frente do filtro de data. Default 14. */
  rangeDays?: number;
};

/**
 * Constrói o `where` do CampaignMetricDaily aplicando:
 *   - escopo do ator (regionIds/franchiseIds para REGIONAL/FRANCHISEE)
 *   - filtros vindos da URL (platform/region/franchise)
 *   - janela de dias
 */
function buildMetricWhere(
  actor: ActorContext,
  filters: DashboardFilters,
): Prisma.CampaignMetricDailyWhereInput {
  const rangeDays = filters.rangeDays ?? 14;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (rangeDays - 1));

  const campaignWhere: Prisma.CampaignWhereInput = { deletedAt: null };
  const franchiseWhere: Prisma.FranchiseWhereInput = {};

  if (filters.platform) campaignWhere.platform = filters.platform;

  // Filtro de franquia, com checagem de escopo. "__forbidden__" garante
  // resultado vazio quando o usuário pede algo fora do que pode ver.
  if (filters.franchiseId) {
    const effective =
      actor.role === "FRANCHISEE" &&
      !actor.franchiseIds?.includes(filters.franchiseId)
        ? "__forbidden__"
        : filters.franchiseId;
    campaignWhere.franchiseId = effective;
  } else if (actor.role === "FRANCHISEE") {
    campaignWhere.franchiseId = { in: actor.franchiseIds ?? ["__none__"] };
  }

  if (filters.regionId) {
    const effective =
      actor.role === "REGIONAL" && !actor.regionIds?.includes(filters.regionId)
        ? "__forbidden__"
        : filters.regionId;
    franchiseWhere.regionId = effective;
  } else if (actor.role === "REGIONAL") {
    franchiseWhere.regionId = { in: actor.regionIds ?? ["__none__"] };
  }

  if (Object.keys(franchiseWhere).length > 0) {
    campaignWhere.franchise = franchiseWhere;
  }

  return {
    date: { gte: since },
    campaign: campaignWhere,
  };
}

export type OverviewSnapshot = {
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
    ctr: number;
    cpc: number;
    cpm: number;
    costPerConversion: number;
  };
  byDay: Array<{
    date: string; // YYYY-MM-DD
    spend: number;
    revenue: number;
    conversions: number;
  }>;
  byPlatform: Array<{
    platform: Platform;
    spend: number;
    revenue: number;
  }>;
  rangeDays: number;
};

export async function loadOverview(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<OverviewSnapshot> {
  const rangeDays = filters.rangeDays ?? 14;
  const where = buildMetricWhere(actor, filters);

  return withTenantScope(tenantId, async (tx) => {
    const [totals, byDay, byPlatform] = await Promise.all([
      tx.campaignMetricDaily.aggregate({
        where,
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
          conversionValue: true,
        },
      }),
      tx.campaignMetricDaily.groupBy({
        by: ["date"],
        where,
        _sum: { spend: true, conversionValue: true, conversions: true },
        orderBy: { date: "asc" },
      }),
      // Plataforma vive em Campaign — precisamos juntar.
      tx.campaign.findMany({
        where: where.campaign,
        select: {
          platform: true,
          metrics: {
            where: { date: { gte: subDays(rangeDays) } },
            select: { spend: true, conversionValue: true },
          },
        },
      }),
    ]);

    const sumSpend = num(totals._sum.spend);
    const sumImpr = totals._sum.impressions ?? 0;
    const sumClicks = totals._sum.clicks ?? 0;
    const sumConv = num(totals._sum.conversions);
    const sumRevenue = num(totals._sum.conversionValue);

    const platformAgg = new Map<Platform, { spend: number; revenue: number }>();
    for (const c of byPlatform) {
      const acc = platformAgg.get(c.platform) ?? { spend: 0, revenue: 0 };
      for (const m of c.metrics) {
        acc.spend += num(m.spend);
        acc.revenue += num(m.conversionValue);
      }
      platformAgg.set(c.platform, acc);
    }

    return {
      totals: {
        spend: sumSpend,
        impressions: sumImpr,
        clicks: sumClicks,
        conversions: sumConv,
        revenue: sumRevenue,
        roas: sumSpend > 0 ? sumRevenue / sumSpend : 0,
        ctr: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0,
        cpc: sumClicks > 0 ? sumSpend / sumClicks : 0,
        cpm: sumImpr > 0 ? (sumSpend / sumImpr) * 1000 : 0,
        costPerConversion: sumConv > 0 ? sumSpend / sumConv : 0,
      },
      byDay: byDay.map((d) => ({
        date: d.date.toISOString().slice(0, 10),
        spend: num(d._sum.spend),
        revenue: num(d._sum.conversionValue),
        conversions: num(d._sum.conversions),
      })),
      byPlatform: Array.from(platformAgg.entries()).map(([platform, v]) => ({
        platform,
        ...v,
      })),
      rangeDays,
    };
  });
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  // Prisma Decimal tem toNumber
  if (typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

function subDays(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (n - 1));
  return d;
}

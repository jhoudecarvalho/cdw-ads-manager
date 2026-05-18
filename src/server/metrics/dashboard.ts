import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import {
  buildFranchiseWhere,
  buildMetricWhere,
  dateSince,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type { DashboardFilters } from "./shared";

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
    reach: number;
    frequency: number;
    activeCampaigns: number;
    totalCampaigns: number;
  };
  /** Por dia, separado por plataforma — alimenta AreaChart e ConversionBars. */
  byDay: Array<{
    date: string;
    googleSpend: number;
    metaSpend: number;
    googleConv: number;
    metaConv: number;
    spend: number;
    revenue: number;
    conversions: number;
  }>;
  byPlatform: Array<{
    platform: Platform;
    spend: number;
    revenue: number;
  }>;
  /** Para o RadarChart de Performance por Região. */
  byRegion: Array<{
    region: string;
    conversions: number;
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
  const since = dateSince(rangeDays);

  return withTenantScope(tenantId, async (tx) => {
    const [totals, byDayTotal, campaignsForSplit, regions] = await Promise.all([
      tx.campaignMetricDaily.aggregate({
        where,
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
          conversionValue: true,
          reach: true,
          frequency: true,
        },
      }),
      tx.campaignMetricDaily.groupBy({
        by: ["date"],
        where,
        _sum: { spend: true, conversionValue: true, conversions: true },
        orderBy: { date: "asc" },
      }),
      // Para split por plataforma E por dia × plataforma.
      tx.campaign.findMany({
        where: where.campaign,
        select: {
          platform: true,
          status: true,
          metrics: {
            where: { date: { gte: since } },
            select: {
              date: true,
              spend: true,
              conversionValue: true,
              conversions: true,
            },
          },
        },
      }),
      // Para o RadarChart — agrega por região via Franchise.region.name.
      tx.region.findMany({
        where: {
          deletedAt: null,
          ...(actor.role === "REGIONAL"
            ? { id: { in: actor.regionIds ?? ["__none__"] } }
            : {}),
        },
        select: {
          name: true,
          franchises: {
            where: buildFranchiseWhere(actor, filters),
            select: {
              campaigns: {
                where: {
                  deletedAt: null,
                  ...(filters.platform ? { platform: filters.platform } : {}),
                },
                select: {
                  metrics: {
                    where: { date: { gte: since } },
                    select: {
                      spend: true,
                      conversions: true,
                      conversionValue: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const sumSpend = num(totals._sum.spend);
    const sumImpr = totals._sum.impressions ?? 0;
    const sumClicks = totals._sum.clicks ?? 0;
    const sumConv = num(totals._sum.conversions);
    const sumRevenue = num(totals._sum.conversionValue);
    const sumReach = totals._sum.reach ?? 0;
    const avgFrequency = num(totals._sum.frequency);

    // Platform aggregates + day×platform.
    const platformAgg = new Map<Platform, { spend: number; revenue: number }>();
    const dayMap = new Map<
      string,
      {
        date: string;
        googleSpend: number;
        metaSpend: number;
        googleConv: number;
        metaConv: number;
        spend: number;
        revenue: number;
        conversions: number;
      }
    >();
    let activeCount = 0;
    for (const c of campaignsForSplit) {
      if (c.status === "ACTIVE") activeCount++;
      const acc = platformAgg.get(c.platform) ?? { spend: 0, revenue: 0 };
      for (const m of c.metrics) {
        const s = num(m.spend);
        const r = num(m.conversionValue);
        const k = num(m.conversions);
        acc.spend += s;
        acc.revenue += r;
        const dateKey = m.date.toISOString().slice(0, 10);
        let day = dayMap.get(dateKey);
        if (!day) {
          day = {
            date: dateKey,
            googleSpend: 0,
            metaSpend: 0,
            googleConv: 0,
            metaConv: 0,
            spend: 0,
            revenue: 0,
            conversions: 0,
          };
          dayMap.set(dateKey, day);
        }
        if (c.platform === "GOOGLE_ADS") {
          day.googleSpend += s;
          day.googleConv += k;
        } else {
          day.metaSpend += s;
          day.metaConv += k;
        }
      }
      platformAgg.set(c.platform, acc);
    }

    // Merge total spend/revenue/conversions from byDayTotal (autoritative for
    // sums; campaignsForSplit duplica via campanha sem date alignment).
    for (const d of byDayTotal) {
      const key = d.date.toISOString().slice(0, 10);
      const day = dayMap.get(key);
      if (day) {
        day.spend = num(d._sum.spend);
        day.revenue = num(d._sum.conversionValue);
        day.conversions = num(d._sum.conversions);
      } else {
        dayMap.set(key, {
          date: key,
          googleSpend: 0,
          metaSpend: 0,
          googleConv: 0,
          metaConv: 0,
          spend: num(d._sum.spend),
          revenue: num(d._sum.conversionValue),
          conversions: num(d._sum.conversions),
        });
      }
    }

    const byDay = Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const byRegion = regions
      .map((r) => {
        let conversions = 0;
        let spend = 0;
        let revenue = 0;
        for (const f of r.franchises) {
          for (const c of f.campaigns) {
            for (const m of c.metrics) {
              conversions += num(m.conversions);
              spend += num(m.spend);
              revenue += num(m.conversionValue);
            }
          }
        }
        return { region: r.name, conversions, spend, revenue };
      })
      .sort((a, b) => b.conversions - a.conversions);

    return {
      totals: {
        spend: sumSpend,
        impressions: sumImpr,
        clicks: sumClicks,
        conversions: sumConv,
        revenue: sumRevenue,
        roas: safeDiv(sumRevenue, sumSpend),
        ctr: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0,
        cpc: safeDiv(sumSpend, sumClicks),
        cpm: sumImpr > 0 ? (sumSpend / sumImpr) * 1000 : 0,
        costPerConversion: safeDiv(sumSpend, sumConv),
        reach: sumReach,
        frequency:
          campaignsForSplit.length > 0
            ? avgFrequency / Math.max(1, campaignsForSplit.length)
            : 0,
        activeCampaigns: activeCount,
        totalCampaigns: campaignsForSplit.length,
      },
      byDay,
      byPlatform: Array.from(platformAgg.entries()).map(([platform, v]) => ({
        platform,
        ...v,
      })),
      byRegion,
      rangeDays,
    };
  });
}

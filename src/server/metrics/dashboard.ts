import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import {
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
  };
  byDay: Array<{
    date: string;
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
      tx.campaign.findMany({
        where: where.campaign,
        select: {
          platform: true,
          metrics: {
            where: { date: { gte: dateSince(rangeDays) } },
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
        roas: safeDiv(sumRevenue, sumSpend),
        ctr: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0,
        cpc: safeDiv(sumSpend, sumClicks),
        cpm: sumImpr > 0 ? (sumSpend / sumImpr) * 1000 : 0,
        costPerConversion: safeDiv(sumSpend, sumConv),
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

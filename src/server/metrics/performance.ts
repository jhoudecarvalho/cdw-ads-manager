import { withTenantScope } from "@/server/db/tenant-scope";
import type { ActorContext } from "@/server/auth/can";
import {
  buildMetricWhere,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type PerformanceSnapshot = {
  conversionRate: number; // conversions / clicks * 100
  revenuePerClick: number;
  costPerClick: number;
  costPerConversion: number;
  ctr: number;
  cpm: number;
  distributionByType: Array<{
    type: string;
    spend: number;
    conversions: number;
    revenue: number;
    share: number; // % do total de spend
  }>;
  rangeDays: number;
};

export async function loadPerformance(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<PerformanceSnapshot> {
  const where = buildMetricWhere(actor, filters);

  return withTenantScope(tenantId, async (tx) => {
    const [totals, campaigns] = await Promise.all([
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
      tx.campaign.findMany({
        where: where.campaign,
        select: {
          type: true,
          metrics: {
            where: { date: where.date as { gte: Date } },
            select: {
              spend: true,
              conversionValue: true,
              conversions: true,
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

    const byTypeMap = new Map<
      string,
      { spend: number; conversions: number; revenue: number }
    >();
    for (const c of campaigns) {
      const t = c.type ?? "OUTROS";
      const slot = byTypeMap.get(t) ?? { spend: 0, conversions: 0, revenue: 0 };
      for (const m of c.metrics) {
        slot.spend += num(m.spend);
        slot.conversions += num(m.conversions);
        slot.revenue += num(m.conversionValue);
      }
      byTypeMap.set(t, slot);
    }

    const distributionByType = Array.from(byTypeMap.entries())
      .map(([type, v]) => ({
        type,
        ...v,
        share: sumSpend > 0 ? (v.spend / sumSpend) * 100 : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

    return {
      conversionRate: sumClicks > 0 ? (sumConv / sumClicks) * 100 : 0,
      revenuePerClick: safeDiv(sumRevenue, sumClicks),
      costPerClick: safeDiv(sumSpend, sumClicks),
      costPerConversion: safeDiv(sumSpend, sumConv),
      ctr: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0,
      cpm: sumImpr > 0 ? (sumSpend / sumImpr) * 1000 : 0,
      distributionByType,
      rangeDays: filters.rangeDays ?? 14,
    };
  });
}

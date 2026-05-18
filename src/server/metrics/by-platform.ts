import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import {
  buildMetricWhere,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type PlatformSlice = {
  platform: Platform;
  totals: {
    spend: number;
    revenue: number;
    roas: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
  };
  byDay: Array<{ date: string; spend: number; revenue: number }>;
  /** Agrega por `Campaign.type` (SEARCH/PMax/Display ou LEAD_GENERATION/TRAFFIC/ENGAGEMENT). */
  byType: Array<{
    type: string;
    spend: number;
    revenue: number;
    conversions: number;
    roas: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    franchiseName: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
  }>;
  rangeDays: number;
};

/**
 * Carrega tudo o que as telas "Google Ads" e "Meta Ads" precisam para uma
 * plataforma específica. Os filtros de plataforma vindos da URL são
 * sobrepostos pela seleção da tela.
 */
export async function loadPlatformSlice(
  tenantId: string,
  actor: ActorContext,
  platform: Platform,
  filters: DashboardFilters,
): Promise<PlatformSlice> {
  const effective: DashboardFilters = { ...filters, platform };
  const where = buildMetricWhere(actor, effective);

  return withTenantScope(tenantId, async (tx) => {
    const [totals, byDay, campaignBuckets] = await Promise.all([
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
        _sum: { spend: true, conversionValue: true },
        orderBy: { date: "asc" },
      }),
      // Para byType e topCampaigns: pega campanhas + métricas agregadas.
      tx.campaign.findMany({
        where: where.campaign,
        select: {
          id: true,
          name: true,
          type: true,
          franchise: { select: { name: true } },
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
    const sumRev = num(totals._sum.conversionValue);
    const sumImpr = totals._sum.impressions ?? 0;
    const sumClicks = totals._sum.clicks ?? 0;
    const sumConv = num(totals._sum.conversions);

    const byTypeMap = new Map<
      string,
      { spend: number; revenue: number; conversions: number }
    >();
    const campaignTotals: PlatformSlice["topCampaigns"] = [];
    for (const c of campaignBuckets) {
      let s = 0,
        r = 0,
        cv = 0;
      for (const m of c.metrics) {
        s += num(m.spend);
        r += num(m.conversionValue);
        cv += num(m.conversions);
      }
      const t = c.type ?? "OUTROS";
      const slot = byTypeMap.get(t) ?? { spend: 0, revenue: 0, conversions: 0 };
      slot.spend += s;
      slot.revenue += r;
      slot.conversions += cv;
      byTypeMap.set(t, slot);

      campaignTotals.push({
        id: c.id,
        name: c.name,
        franchiseName: c.franchise.name,
        spend: s,
        revenue: r,
        roas: safeDiv(r, s),
        conversions: cv,
      });
    }

    const byType = Array.from(byTypeMap.entries())
      .map(([type, v]) => ({
        type,
        ...v,
        roas: safeDiv(v.revenue, v.spend),
      }))
      .sort((a, b) => b.spend - a.spend);

    const topCampaigns = campaignTotals
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      platform,
      totals: {
        spend: sumSpend,
        revenue: sumRev,
        roas: safeDiv(sumRev, sumSpend),
        impressions: sumImpr,
        clicks: sumClicks,
        conversions: sumConv,
        ctr: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0,
        cpc: safeDiv(sumSpend, sumClicks),
      },
      byDay: byDay.map((d) => ({
        date: d.date.toISOString().slice(0, 10),
        spend: num(d._sum.spend),
        revenue: num(d._sum.conversionValue),
      })),
      byType,
      topCampaigns,
      rangeDays: filters.rangeDays ?? 14,
    };
  });
}

import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import {
  buildFranchiseWhere,
  dateSince,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type FranchiseRanking = {
  franchiseId: string;
  name: string;
  city: string;
  state: string;
  regionName: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  clicks: number;
  ctr: number;
  byPlatform: Record<Platform, { spend: number; revenue: number }>;
};

/**
 * Para cada franquia no escopo, agrega métricas no range. Ordena por ROAS
 * desc por padrão — a tela Franquias mostra como ranking.
 */
export async function loadFranchiseRankings(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<FranchiseRanking[]> {
  const rangeDays = filters.rangeDays ?? 14;
  const since = dateSince(rangeDays);
  const franchiseWhere = buildFranchiseWhere(actor, filters);

  return withTenantScope(tenantId, async (tx) => {
    const franchises = await tx.franchise.findMany({
      where: franchiseWhere,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        region: { select: { name: true } },
        campaigns: {
          where: {
            deletedAt: null,
            ...(filters.platform ? { platform: filters.platform } : {}),
          },
          select: {
            platform: true,
            metrics: {
              where: { date: { gte: since } },
              select: {
                spend: true,
                conversionValue: true,
                conversions: true,
                clicks: true,
                impressions: true,
              },
            },
          },
        },
      },
    });

    const out: FranchiseRanking[] = franchises.map((f) => {
      let spend = 0;
      let revenue = 0;
      let conversions = 0;
      let clicks = 0;
      let impressions = 0;
      const byPlatform: Record<Platform, { spend: number; revenue: number }> = {
        GOOGLE_ADS: { spend: 0, revenue: 0 },
        META_ADS: { spend: 0, revenue: 0 },
      };

      for (const c of f.campaigns) {
        for (const m of c.metrics) {
          const s = num(m.spend);
          const r = num(m.conversionValue);
          spend += s;
          revenue += r;
          conversions += num(m.conversions);
          clicks += m.clicks;
          impressions += m.impressions;
          byPlatform[c.platform].spend += s;
          byPlatform[c.platform].revenue += r;
        }
      }

      return {
        franchiseId: f.id,
        name: f.name,
        city: f.city,
        state: f.state,
        regionName: f.region.name,
        spend,
        revenue,
        roas: safeDiv(revenue, spend),
        conversions,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        byPlatform,
      };
    });

    out.sort((a, b) => b.roas - a.roas);
    return out;
  });
}

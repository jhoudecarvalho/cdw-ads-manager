import { withTenantScope } from "@/server/db/tenant-scope";
import type { ActorContext } from "@/server/auth/can";
import {
  buildFranchiseWhere,
  dateSince,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type RegionSummary = {
  regionId: string;
  name: string;
  franchiseCount: number;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  clicks: number;
  impressions: number;
  ctr: number;
};

export async function loadRegionSummary(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<RegionSummary[]> {
  const rangeDays = filters.rangeDays ?? 14;
  const since = dateSince(rangeDays);
  const franchiseWhere = buildFranchiseWhere(actor, filters);

  return withTenantScope(tenantId, async (tx) => {
    // Carrega regiões e franquias do escopo numa só query.
    const regions = await tx.region.findMany({
      where: {
        deletedAt: null,
        ...(actor.role === "REGIONAL"
          ? { id: { in: actor.regionIds ?? ["__none__"] } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        franchises: {
          where: franchiseWhere,
          select: {
            id: true,
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
                    conversionValue: true,
                    conversions: true,
                    clicks: true,
                    impressions: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return regions.map((r) => {
      let spend = 0,
        revenue = 0,
        conversions = 0,
        clicks = 0,
        impressions = 0;
      for (const f of r.franchises) {
        for (const c of f.campaigns) {
          for (const m of c.metrics) {
            spend += num(m.spend);
            revenue += num(m.conversionValue);
            conversions += num(m.conversions);
            clicks += m.clicks;
            impressions += m.impressions;
          }
        }
      }
      return {
        regionId: r.id,
        name: r.name,
        franchiseCount: r.franchises.length,
        spend,
        revenue,
        roas: safeDiv(revenue, spend),
        conversions,
        clicks,
        impressions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      };
    });
  });
}

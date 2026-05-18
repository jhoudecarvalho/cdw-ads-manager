import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform, CampaignStatus } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import {
  buildCampaignWhere,
  dateSince,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type CampaignRow = {
  id: string;
  name: string;
  type: string | null;
  platform: Platform;
  status: CampaignStatus;
  franchiseName: string;
  franchiseCity: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  clicks: number;
  impressions: number;
};

/**
 * Lista todas as campanhas visíveis para o ator com agregados de métricas
 * no range. Ordena por receita desc.
 *
 * Sem paginação no backend ainda — para 300 franquias × 6 campanhas é ~1800
 * linhas, comporta no client. Se virar gargalo, adicionar take/skip.
 */
export async function loadCampaignsList(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<CampaignRow[]> {
  const rangeDays = filters.rangeDays ?? 14;
  const since = dateSince(rangeDays);
  const where = buildCampaignWhere(actor, filters);

  return withTenantScope(tenantId, async (tx) => {
    const campaigns = await tx.campaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        platform: true,
        status: true,
        franchise: { select: { name: true, city: true } },
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
    });

    const rows: CampaignRow[] = campaigns.map((c) => {
      let spend = 0,
        revenue = 0,
        conversions = 0,
        clicks = 0,
        impressions = 0;
      for (const m of c.metrics) {
        spend += num(m.spend);
        revenue += num(m.conversionValue);
        conversions += num(m.conversions);
        clicks += m.clicks;
        impressions += m.impressions;
      }
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        platform: c.platform,
        status: c.status,
        franchiseName: c.franchise.name,
        franchiseCity: c.franchise.city,
        spend,
        revenue,
        roas: safeDiv(revenue, spend),
        conversions,
        clicks,
        impressions,
      };
    });

    rows.sort((a, b) => b.revenue - a.revenue);
    return rows;
  });
}

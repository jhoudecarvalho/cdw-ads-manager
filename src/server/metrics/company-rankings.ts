import { withTenantScope } from "@/server/db/tenant-scope";
import type { Platform } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import { dateSince, num, safeDiv, type DashboardFilters } from "./shared";

export type CompanyRanking = {
  companyId: string;
  externalCode: string;
  name: string;
  sector: string;
  status: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  clicks: number;
  ctr: number;
  byPlatform: Record<Platform, { spend: number; revenue: number }>;
};

/**
 * Para cada empresa no escopo, agrega métricas no range. Ordena por ROAS desc
 * — espelha `franchise-rankings.ts` para o modo COMPANY. Sem dependência de
 * Region (não existe nesse modo).
 *
 * Filtro `franchiseId` (legado do querystring) é reinterpretado como
 * `companyId` quando o tenant é COMPANY — preserva URLs antigas e reaproveita
 * o `FilterBar` sem duplicar parâmetros.
 */
export async function loadCompanyRankings(
  tenantId: string,
  _actor: ActorContext,
  filters: DashboardFilters,
): Promise<CompanyRanking[]> {
  const rangeDays = filters.rangeDays ?? 14;
  const since = dateSince(rangeDays);

  return withTenantScope(tenantId, async (tx) => {
    const companies = await tx.company.findMany({
      where: {
        deletedAt: null,
        ...(filters.franchiseId ? { id: filters.franchiseId } : {}),
      },
      select: {
        id: true,
        externalCode: true,
        name: true,
        sector: true,
        status: true,
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

    const out: CompanyRanking[] = companies.map((co) => {
      let spend = 0;
      let revenue = 0;
      let conversions = 0;
      let clicks = 0;
      let impressions = 0;
      const byPlatform: Record<Platform, { spend: number; revenue: number }> = {
        GOOGLE_ADS: { spend: 0, revenue: 0 },
        META_ADS: { spend: 0, revenue: 0 },
      };

      for (const c of co.campaigns) {
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
        companyId: co.id,
        externalCode: co.externalCode,
        name: co.name,
        sector: co.sector ?? "Sem setor",
        status: co.status,
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

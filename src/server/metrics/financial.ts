import { withTenantScope } from "@/server/db/tenant-scope";
import type { ActorContext } from "@/server/auth/can";
import {
  buildMetricWhere,
  num,
  safeDiv,
  type DashboardFilters,
} from "./shared";

export type FinancialSnapshot = {
  cost: number;
  revenue: number;
  grossProfit: number;
  margin: number; // %
  avgDailyCost: number;
  avgDailyRevenue: number;
  byDay: Array<{
    date: string;
    cost: number;
    revenue: number;
    profit: number;
  }>;
  rangeDays: number;
};

export async function loadFinancial(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<FinancialSnapshot> {
  const rangeDays = filters.rangeDays ?? 14;
  const where = buildMetricWhere(actor, filters);

  return withTenantScope(tenantId, async (tx) => {
    const [totals, byDay] = await Promise.all([
      tx.campaignMetricDaily.aggregate({
        where,
        _sum: { spend: true, conversionValue: true },
      }),
      tx.campaignMetricDaily.groupBy({
        by: ["date"],
        where,
        _sum: { spend: true, conversionValue: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const cost = num(totals._sum.spend);
    const revenue = num(totals._sum.conversionValue);
    const grossProfit = revenue - cost;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      cost,
      revenue,
      grossProfit,
      margin,
      avgDailyCost: safeDiv(cost, rangeDays),
      avgDailyRevenue: safeDiv(revenue, rangeDays),
      byDay: byDay.map((d) => {
        const c = num(d._sum.spend);
        const r = num(d._sum.conversionValue);
        return {
          date: d.date.toISOString().slice(0, 10),
          cost: c,
          revenue: r,
          profit: r - c,
        };
      }),
      rangeDays,
    };
  });
}

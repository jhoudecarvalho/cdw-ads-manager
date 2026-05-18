import type { Platform, Prisma } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";

/**
 * Fundação dos loaders de dashboard. Todo loader em `src/server/metrics/*`
 * passa por `buildMetricWhere` — assim toda checagem de escopo (filtros da
 * URL + papel do usuário) acontece em um lugar único.
 */

export type DashboardFilters = {
  platform: Platform | null;
  regionId: string | null;
  franchiseId: string | null;
  /** Janela em dias retroativa a partir de hoje (UTC). Default 14. */
  rangeDays?: number;
};

/**
 * Construtor do `where` aplicado em `CampaignMetricDaily`:
 *   - escopo do ator (REGIONAL/FRANCHISEE caem em ids vinculados)
 *   - filtros URL (platform/region/franchise), invalidados se fora do escopo
 *   - janela de data
 *
 * Resultado: filtro reutilizável tanto para aggregate quanto para join via
 * `where.campaign` (algumas queries precisam pegar só o pedaço de Campaign).
 */
export function buildMetricWhere(
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

/**
 * `where` específico de `Campaign` (sem o filtro de data, que vive no
 * metric). Útil para listagens da tabela `Campanhas` e para escopo de
 * franquias visíveis.
 */
export function buildCampaignWhere(
  actor: ActorContext,
  filters: DashboardFilters,
): Prisma.CampaignWhereInput {
  // Reusa o construtor — só pega a parte de campaign.
  const where = buildMetricWhere(actor, filters);
  return (where.campaign as Prisma.CampaignWhereInput) ?? { deletedAt: null };
}

/**
 * `where` para `Franchise` respeitando escopo do ator e filtro de região.
 * Não considera platform/franchiseId — quem usa é a tela Franquias que
 * itera sobre franquias inteiras.
 */
export function buildFranchiseWhere(
  actor: ActorContext,
  filters: DashboardFilters,
): Prisma.FranchiseWhereInput {
  const where: Prisma.FranchiseWhereInput = { deletedAt: null };

  if (filters.regionId) {
    const effective =
      actor.role === "REGIONAL" && !actor.regionIds?.includes(filters.regionId)
        ? "__forbidden__"
        : filters.regionId;
    where.regionId = effective;
  } else if (actor.role === "REGIONAL") {
    where.regionId = { in: actor.regionIds ?? ["__none__"] };
  }

  if (actor.role === "FRANCHISEE") {
    where.id = { in: actor.franchiseIds ?? ["__none__"] };
  }

  return where;
}

export function dateSince(rangeDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (rangeDays - 1));
  return d;
}

/** Coerce de Decimal/string/number para number. */
export function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

export function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

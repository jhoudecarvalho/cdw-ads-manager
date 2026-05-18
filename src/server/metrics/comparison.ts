import type { Platform } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import { loadPlatformSlice, type PlatformSlice } from "./by-platform";
import type { DashboardFilters } from "./shared";

export type ComparisonSnapshot = {
  google: PlatformSlice;
  meta: PlatformSlice;
  rangeDays: number;
};

/**
 * Carrega Google e Meta em paralelo no mesmo escopo de filtros. A tela
 * Comparativo mostra os dois lado a lado.
 *
 * Ignora `filters.platform` (não faz sentido restringir a uma plataforma
 * aqui — o ponto da tela é justamente comparar).
 */
export async function loadComparison(
  tenantId: string,
  actor: ActorContext,
  filters: DashboardFilters,
): Promise<ComparisonSnapshot> {
  const base = { ...filters, platform: null as Platform | null };
  const [google, meta] = await Promise.all([
    loadPlatformSlice(tenantId, actor, "GOOGLE_ADS", base),
    loadPlatformSlice(tenantId, actor, "META_ADS", base),
  ]);
  return { google, meta, rangeDays: filters.rangeDays ?? 14 };
}

import type { Platform } from "@/generated/prisma/client";
import type { DashboardFilters } from "@/server/metrics/shared";

const PLATFORMS = new Set<Platform>(["GOOGLE_ADS", "META_ADS"]);

/**
 * Lê e normaliza os filtros do URL.searchParams. As páginas chamam isso pra
 * não repetir o boilerplate de validar string → enum.
 */
export function parseDashboardFilters(
  sp: { platform?: string; region?: string; franchise?: string },
  defaults: { rangeDays?: number } = {},
): DashboardFilters {
  return {
    platform:
      sp.platform && PLATFORMS.has(sp.platform as Platform)
        ? (sp.platform as Platform)
        : null,
    regionId: sp.region ?? null,
    franchiseId: sp.franchise ?? null,
    rangeDays: defaults.rangeDays,
  };
}

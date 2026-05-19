import type { TenantType } from "@/generated/prisma/client";

/**
 * Fonte única do "shape" operacional de cada tipo de tenant.
 *
 * Por que existe: o sistema atende dois modos — Franquia (Region → Franchise)
 * e Empresa (lista plana). Em vez de espalhar `if (tenantType === ...)` pela
 * UI, queries e rótulos, lemos a config daqui. Sidebar, FilterBar, headers,
 * metrics e Server Actions consomem `getTenantModule(tenantType)`.
 *
 * Regra: tudo que muda de comportamento entre os dois modos deve ter um
 * campo aqui. Se aparecer um terceiro modo (improvável), basta estender este
 * objeto — nada na UI precisa de novos branches.
 */
export type TenantModule = {
  /** Rótulo singular da unidade (exibido em headers, breadcrumbs). */
  unitLabel: string;
  /** Rótulo plural — usado em listagens, KPIs, "Todas as X". */
  unitLabelPlural: string;
  /** Se `true`, a UI mostra a camada de Region (filtro, agrupamento, página). */
  hasRegions: boolean;
  /**
   * Se `true`, o tenant cadastra suas próprias unidades pela UI (modo
   * COMPANY). FRANCHISE recebe franquias por seed/processo administrativo,
   * não pela UI do tenant.
   */
  canRegisterUnits: boolean;
  /**
   * Eixo de agrupamento para relatórios "por região/setor". No modo
   * FRANCHISE agrupa por Region; no modo COMPANY agrupa por Company.sector.
   */
  groupBy: "region" | "sector";
};

export const TENANT_MODULES: Record<TenantType, TenantModule> = {
  FRANCHISE: {
    unitLabel: "Franquia",
    unitLabelPlural: "Franquias",
    hasRegions: true,
    canRegisterUnits: false,
    groupBy: "region",
  },
  COMPANY: {
    unitLabel: "Empresa",
    unitLabelPlural: "Empresas",
    hasRegions: false,
    canRegisterUnits: true,
    groupBy: "sector",
  },
};

export function getTenantModule(type: TenantType): TenantModule {
  return TENANT_MODULES[type];
}

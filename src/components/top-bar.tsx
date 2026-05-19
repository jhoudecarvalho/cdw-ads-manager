import { withTenantScope } from "@/server/db/tenant-scope";
import type { TenantType } from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";
import { getTenantModule } from "@/server/tenant/tenant-modules";
import { FilterBar } from "./filter-bar";

type Props = {
  tenantId: string;
  tenantType: TenantType;
  actor: ActorContext;
};

/**
 * Top bar do app shell.
 *
 * Carrega no servidor as opções de Região e unidade (Franquia ou Empresa,
 * conforme `tenantType`) que o usuário **pode** ver — depois passa para o
 * `FilterBar` (cliente) que sincroniza com a URL.
 *
 * Filtros por papel:
 *   - ADMIN: tudo do tenant.
 *   - REGIONAL (só modo FRANCHISE): só as regiões vinculadas e franquias dentro.
 *   - FRANCHISEE (só modo FRANCHISE): só a própria franquia (sem dropdown de região).
 *
 * No modo COMPANY não há REGIONAL — toda interação é ADMIN ou FRANCHISEE
 * (que, neste modo, seria uma futura noção de "responsável por uma empresa";
 * por ora só ADMIN está em uso).
 */
export async function TopBar({ tenantId, tenantType, actor }: Props) {
  const mod = getTenantModule(tenantType);

  const { regions, units } = await withTenantScope(tenantId, async (tx) => {
    if (tenantType === "COMPANY") {
      // Modo COMPANY: lista de empresas como "unidades". Sem regions.
      if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
        const companies = await tx.company.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        return {
          regions: [] as { id: string; name: string }[],
          units: companies.map((c) => ({
            id: c.id,
            name: c.name,
            regionId: null,
          })),
        };
      }
      // REGIONAL não existe no modo COMPANY; FRANCHISEE no modo COMPANY
      // ainda não tem vínculo com Company definido — retorna vazio.
      return {
        regions: [] as { id: string; name: string }[],
        units: [] as { id: string; name: string; regionId: string | null }[],
      };
    }

    // Modo FRANCHISE
    if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
      return {
        regions: await tx.region.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        units: (
          await tx.franchise.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, regionId: true },
            orderBy: { name: "asc" },
          })
        ).map((f) => ({ id: f.id, name: f.name, regionId: f.regionId })),
      };
    }

    if (actor.role === "REGIONAL") {
      const regionIds = actor.regionIds ?? [];
      return {
        regions: await tx.region.findMany({
          where: { id: { in: regionIds }, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        units: (
          await tx.franchise.findMany({
            where: { regionId: { in: regionIds }, deletedAt: null },
            select: { id: true, name: true, regionId: true },
            orderBy: { name: "asc" },
          })
        ).map((f) => ({ id: f.id, name: f.name, regionId: f.regionId })),
      };
    }

    // FRANCHISEE
    const franchiseIds = actor.franchiseIds ?? [];
    return {
      regions: [],
      units: (
        await tx.franchise.findMany({
          where: { id: { in: franchiseIds }, deletedAt: null },
          select: { id: true, name: true, regionId: true },
          orderBy: { name: "asc" },
        })
      ).map((f) => ({ id: f.id, name: f.name, regionId: f.regionId })),
    };
  });

  // Em impersonação, o SUPER_ADMIN enxerga este shell como ADMIN do tenant
  // alvo. FilterBar não conhece SUPER_ADMIN — colapsamos aqui.
  const role = actor.role === "SUPER_ADMIN" ? "ADMIN" : actor.role;
  return (
    <FilterBar
      role={role}
      hasRegions={mod.hasRegions}
      unitLabelPlural={mod.unitLabelPlural}
      regions={regions}
      units={units}
    />
  );
}

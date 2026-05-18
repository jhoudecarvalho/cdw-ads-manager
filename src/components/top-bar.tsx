import { withTenantScope } from "@/server/db/tenant-scope";
import type { ActorContext } from "@/server/auth/can";
import { FilterBar } from "./filter-bar";

type Props = {
  tenantId: string;
  actor: ActorContext;
};

/**
 * Top bar do app shell.
 *
 * Carrega no servidor as opções de Região e Franquia que o usuário **pode**
 * ver — depois passa para o `FilterBar` (cliente) que sincroniza com a URL.
 *
 * Filtros por papel:
 *   - ADMIN: todas as regiões e franquias do tenant.
 *   - REGIONAL: só as regiões vinculadas e franquias dentro delas.
 *   - FRANCHISEE: só a própria franquia (sem dropdown de região).
 */
export async function TopBar({ tenantId, actor }: Props) {
  const { regions, franchises } = await withTenantScope(
    tenantId,
    async (tx) => {
      if (actor.role === "ADMIN") {
        return {
          regions: await tx.region.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          franchises: await tx.franchise.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, regionId: true },
            orderBy: { name: "asc" },
          }),
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
          franchises: await tx.franchise.findMany({
            where: { regionId: { in: regionIds }, deletedAt: null },
            select: { id: true, name: true, regionId: true },
            orderBy: { name: "asc" },
          }),
        };
      }

      // FRANCHISEE
      const franchiseIds = actor.franchiseIds ?? [];
      return {
        regions: [],
        franchises: await tx.franchise.findMany({
          where: { id: { in: franchiseIds }, deletedAt: null },
          select: { id: true, name: true, regionId: true },
          orderBy: { name: "asc" },
        }),
      };
    },
  );

  return (
    <FilterBar role={actor.role} regions={regions} franchises={franchises} />
  );
}

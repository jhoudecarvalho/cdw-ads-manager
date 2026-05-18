import { cache } from "react";
import type { Session } from "next-auth";
import { withTenantScope } from "@/server/db/tenant-scope";
import type { ActorContext } from "./can";

/**
 * Carrega o `ActorContext` completo a partir da sessão — inclui os vínculos
 * com franquias e regiões, necessários para `can()` resolver REGIONAL e
 * FRANCHISEE corretamente.
 *
 * Cacheada por request via `react.cache()` — server components, layouts e
 * route handlers podem chamar várias vezes sem custo extra.
 */
export const loadActorContext = cache(
  async (session: Session): Promise<ActorContext> => {
    const { id, tenantId, role } = session.user;

    // ADMIN não tem filtros por franquia/região — `can()` libera tudo
    // dentro do tenant. Evitamos as queries.
    if (role === "ADMIN") {
      return { id, tenantId, role };
    }

    const { franchiseIds, regionIds } = await withTenantScope(
      tenantId,
      async (tx) => {
        const [franchises, regions] = await Promise.all([
          tx.userFranchise.findMany({
            where: { userId: id },
            select: { franchiseId: true },
          }),
          tx.userRegion.findMany({
            where: { userId: id },
            select: { regionId: true },
          }),
        ]);
        return {
          franchiseIds: franchises.map((f) => f.franchiseId),
          regionIds: regions.map((r) => r.regionId),
        };
      },
    );

    return { id, tenantId, role, franchiseIds, regionIds };
  },
);

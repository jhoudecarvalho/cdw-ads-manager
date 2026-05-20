import { withTenantScope } from "@/server/db/tenant-scope";
import type {
  AdAccountStatus,
  Platform,
} from "@/generated/prisma/client";
import type { ActorContext } from "@/server/auth/can";

export type AdAccountRow = {
  id: string;
  platform: Platform;
  externalAccountId: string;
  status: AdAccountStatus;
  /** Nome da unidade dona da conta (franquia OU empresa). */
  unitName: string;
  /** "franchise" | "company" — qual lado do polimorfismo está preenchido. */
  unitKind: "franchise" | "company";
  unitId: string;
  campaignCount: number;
  lastSyncAt: Date | null;
  createdAt: Date;
};

/**
 * Lista as contas de anúncio ativas (não removidas) do tenant, com o nome da
 * unidade dona e a contagem de campanhas. Escopo do ator:
 *   - ADMIN / SUPER_ADMIN (impersonando): todas as contas do tenant.
 *   - FRANCHISEE: só contas das franquias vinculadas.
 *   - REGIONAL: só contas de franquias nas regiões vinculadas.
 */
export async function listAdAccounts(
  tenantId: string,
  actor: ActorContext,
): Promise<AdAccountRow[]> {
  return withTenantScope(tenantId, async (tx) => {
    // Filtro de escopo por papel. ADMIN/SUPER_ADMIN não filtram.
    const where: Record<string, unknown> = { deletedAt: null };
    if (actor.role === "FRANCHISEE") {
      where.franchiseId = { in: actor.franchiseIds ?? ["__none__"] };
    } else if (actor.role === "REGIONAL") {
      where.franchise = {
        regionId: { in: actor.regionIds ?? ["__none__"] },
      };
    }

    const accounts = await tx.adAccount.findMany({
      where,
      select: {
        id: true,
        platform: true,
        externalAccountId: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        franchiseId: true,
        companyId: true,
        franchise: { select: { name: true } },
        company: { select: { name: true } },
        _count: { select: { campaigns: true } },
      },
      orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
    });

    return accounts.map((a): AdAccountRow => {
      const isFranchise = a.franchiseId != null;
      return {
        id: a.id,
        platform: a.platform,
        externalAccountId: a.externalAccountId,
        status: a.status,
        unitName: a.franchise?.name ?? a.company?.name ?? "—",
        unitKind: isFranchise ? "franchise" : "company",
        unitId: (a.franchiseId ?? a.companyId)!,
        campaignCount: a._count.campaigns,
        lastSyncAt: a.lastSyncAt,
        createdAt: a.createdAt,
      };
    });
  });
}

export type UnitOption = { id: string; name: string };

/**
 * Unidades elegíveis para vincular uma conta nova, conforme o `tenantType`.
 * Em FRANCHISE retorna franquias (respeitando escopo); em COMPANY retorna
 * empresas ativas.
 */
export async function listUnitOptions(
  tenantId: string,
  actor: ActorContext,
): Promise<UnitOption[]> {
  return withTenantScope(tenantId, async (tx) => {
    if (actor.tenantType === "COMPANY") {
      const companies = await tx.company.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, externalCode: true },
        orderBy: { externalCode: "asc" },
      });
      return companies.map((c) => ({
        id: c.id,
        name: `${c.externalCode} · ${c.name}`,
      }));
    }

    const franchiseWhere: Record<string, unknown> = { deletedAt: null };
    if (actor.role === "FRANCHISEE") {
      franchiseWhere.id = { in: actor.franchiseIds ?? ["__none__"] };
    } else if (actor.role === "REGIONAL") {
      franchiseWhere.regionId = { in: actor.regionIds ?? ["__none__"] };
    }
    const franchises = await tx.franchise.findMany({
      where: franchiseWhere,
      select: { id: true, name: true, city: true, state: true },
      orderBy: { name: "asc" },
    });
    return franchises.map((f) => ({
      id: f.id,
      name: `${f.name} (${f.city}/${f.state})`,
    }));
  });
}

import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import type { TenantStatus, TenantType } from "@/generated/prisma/client";

/**
 * Queries cross-tenant para o Super Admin.
 *
 * Estratégia: a tabela `Tenant` não tem RLS — leitura direta. Para dados de
 * negócio (Franchise, Company, Campaign, AdAccount), iteramos tenant a tenant
 * dentro de `withTenantScope` em paralelo. Mantém RLS como defesa final;
 * sem nenhuma flag de bypass.
 *
 * Esconde o tenant técnico `system` — ele não é um cliente.
 */

export type TenantOverview = {
  id: string;
  slug: string;
  name: string;
  tenantType: TenantType;
  status: TenantStatus;
  primaryColor: string | null;
  logoUrl: string | null;
  createdAt: Date;
  /** Contagem de unidades (franchises OU companies, conforme o tenantType). */
  unitCount: number;
  campaignCount: number;
  /** Soma de spend nos últimos `rangeDays` dias — opcional. */
  spendLastNDays: number | null;
};

const SYSTEM_TENANT_ID = "system";

export async function listTenants(opts: {
  includeSystem?: boolean;
  rangeDays?: number;
} = {}): Promise<TenantOverview[]> {
  const { includeSystem = false, rangeDays } = opts;

  const tenants = await prisma.tenant.findMany({
    where: includeSystem
      ? { deletedAt: null }
      : { deletedAt: null, NOT: { id: SYSTEM_TENANT_ID } },
    select: {
      id: true,
      slug: true,
      name: true,
      tenantType: true,
      status: true,
      primaryColor: true,
      logoUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const since = rangeDays ? dateSince(rangeDays) : null;

  // Paralelo controlado: para volumes maiores podemos passar a usar uma
  // raw query única com BYPASSRLS condicional — por ora, iterar é simples e
  // não fura camada.
  const enriched = await Promise.all(
    tenants.map(async (t) => {
      const counts = await withTenantScope(t.id, async (tx) => {
        const [franchises, companies, campaigns, spendAgg] = await Promise.all([
          t.tenantType === "FRANCHISE"
            ? tx.franchise.count({ where: { deletedAt: null } })
            : Promise.resolve(0),
          t.tenantType === "COMPANY"
            ? tx.company.count({ where: { deletedAt: null } })
            : Promise.resolve(0),
          tx.campaign.count({ where: { deletedAt: null } }),
          since
            ? tx.campaignMetricDaily.aggregate({
                where: { date: { gte: since } },
                _sum: { spend: true },
              })
            : Promise.resolve(null),
        ]);
        return {
          unitCount:
            t.tenantType === "FRANCHISE" ? franchises : companies,
          campaignCount: campaigns,
          spendLastNDays: spendAgg
            ? num(spendAgg._sum.spend)
            : null,
        };
      });
      return { ...t, ...counts };
    }),
  );

  return enriched;
}

function dateSince(rangeDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (rangeDays - 1));
  return d;
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

/**
 * Lista unidades globais — franquias e empresas de todos os tenants. Para a
 * tela "Unidades" do Super Admin.
 */
export type GlobalUnit = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantType: TenantType;
  id: string;
  externalCode: string | null;
  name: string;
  status: string;
  extra: string;
};

export async function listAllUnits(): Promise<GlobalUnit[]> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, NOT: { id: SYSTEM_TENANT_ID } },
    select: { id: true, slug: true, name: true, tenantType: true },
  });

  const all = await Promise.all(
    tenants.map(async (t) => {
      return withTenantScope(t.id, async (tx) => {
        if (t.tenantType === "FRANCHISE") {
          const fs = await tx.franchise.findMany({
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              status: true,
              city: true,
              state: true,
              region: { select: { name: true } },
            },
            orderBy: { name: "asc" },
          });
          return fs.map<GlobalUnit>((f) => ({
            tenantId: t.id,
            tenantSlug: t.slug,
            tenantName: t.name,
            tenantType: t.tenantType,
            id: f.id,
            externalCode: null,
            name: f.name,
            status: f.status,
            extra: `${f.region.name} · ${f.city}/${f.state}`,
          }));
        }
        const cs = await tx.company.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            externalCode: true,
            name: true,
            status: true,
            sector: true,
          },
          orderBy: { externalCode: "asc" },
        });
        return cs.map<GlobalUnit>((c) => ({
          tenantId: t.id,
          tenantSlug: t.slug,
          tenantName: t.name,
          tenantType: t.tenantType,
          id: c.id,
          externalCode: c.externalCode,
          name: c.name,
          status: c.status,
          extra: c.sector ?? "Sem setor",
        }));
      });
    }),
  );

  return all.flat();
}

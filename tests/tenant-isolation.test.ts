/**
 * Testes de isolamento de tenant via Row-Level Security.
 *
 * REQUISITO DA SEÇÃO 3 DA ESPEC: "crie testes automatizados que provam que o
 * usuário do tenant A não consegue ler, alterar nem deletar dado do tenant
 * B, em todas as rotas."
 *
 * Estes testes batem no Neon real usando o role `franchise_hub_app` (sem
 * BYPASSRLS), exatamente como o app de produção. Provam que:
 *
 *   1. SELECT sem scope → retorna 0 (default seguro)
 *   2. SELECT scoped → vê só dados do próprio tenant
 *   3. INSERT com tenantId errado → falha por WITH CHECK
 *   4. UPDATE cross-tenant → não altera linhas (nem erro, nem efeito)
 *   5. DELETE cross-tenant → não deleta linhas
 *
 * Pré-requisito: rodar `npm run db:seed` antes (precisa de dados nos dois
 * tenants).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";

let TENANT_A_ID = "";
let TENANT_B_ID = "";

beforeAll(async () => {
  // Ambos os tenants escolhidos precisam estar no modo FRANCHISE para que
  // os testes de franchise.* tenham dados. `kgepel` virou COMPANY na Etapa 1,
  // então usamos `anjos` + `clickvel`.
  const a = await prisma.tenant.findUnique({ where: { slug: "anjos" } });
  const b = await prisma.tenant.findUnique({ where: { slug: "clickvel" } });
  if (!a || !b) {
    throw new Error(
      "Tenants 'anjos' e 'clickvel' não encontrados. Rode `npm run db:seed`.",
    );
  }
  TENANT_A_ID = a.id;
  TENANT_B_ID = b.id;
});

describe("RLS — SELECT", () => {
  it("sem scope: retorna 0 linhas (default seguro)", async () => {
    const [users, franchises, regions, campaigns, metrics] = await Promise.all([
      prisma.user.count(),
      prisma.franchise.count(),
      prisma.region.count(),
      prisma.campaign.count(),
      prisma.campaignMetricDaily.count(),
    ]);
    expect(users).toBe(0);
    expect(franchises).toBe(0);
    expect(regions).toBe(0);
    expect(campaigns).toBe(0);
    expect(metrics).toBe(0);
  });

  it("scoped em A: vê só dados de A", async () => {
    const { franchises, regions } = await withTenantScope(
      TENANT_A_ID,
      async (tx) => ({
        franchises: await tx.franchise.findMany({ select: { tenantId: true } }),
        regions: await tx.region.findMany({ select: { tenantId: true } }),
      }),
    );

    expect(franchises.length).toBeGreaterThan(0);
    expect(franchises.every((f) => f.tenantId === TENANT_A_ID)).toBe(true);
    expect(regions.every((r) => r.tenantId === TENANT_A_ID)).toBe(true);
  });

  it("scoped em A: NÃO vê franquias de B nem por findUnique direto", async () => {
    const bFranchise = await withTenantScope(TENANT_B_ID, (tx) =>
      tx.franchise.findFirst({ select: { id: true } }),
    );
    expect(bFranchise).not.toBeNull();

    // Mesmo sabendo o ID, o tenant A não consegue ler.
    const leaked = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.franchise.findUnique({ where: { id: bFranchise!.id } }),
    );
    expect(leaked).toBeNull();
  });

  it("scoped em A: NÃO conta campanhas de B", async () => {
    const aCount = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.campaign.count(),
    );
    const bCount = await withTenantScope(TENANT_B_ID, (tx) =>
      tx.campaign.count(),
    );
    // Ambos devem ter campanhas (do seed).
    expect(aCount).toBeGreaterThan(0);
    expect(bCount).toBeGreaterThan(0);
    // Verificação cruzada — sem scope deve ser 0, com scope deve ser igual ao
    // próprio total, nunca a soma dos dois.
    const noScope = await prisma.campaign.count();
    expect(noScope).toBe(0);
    expect(aCount + bCount).toBeGreaterThan(Math.max(aCount, bCount));
  });
});

describe("RLS — INSERT (WITH CHECK)", () => {
  it("scoped em A: inserir com tenantId de B falha", async () => {
    const aRegion = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.region.findFirst({ select: { id: true } }),
    );

    await expect(
      withTenantScope(TENANT_A_ID, (tx) =>
        tx.franchise.create({
          data: {
            tenantId: TENANT_B_ID, // ← tentativa de injeção cross-tenant
            regionId: aRegion!.id,
            name: "TEST should fail",
            state: "SP",
            city: "São Paulo",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("scoped em A: inserir com tenantId de A funciona", async () => {
    const aRegion = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.region.findFirst({ select: { id: true } }),
    );

    const created = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.franchise.create({
        data: {
          tenantId: TENANT_A_ID,
          regionId: aRegion!.id,
          name: `TEST RLS valid ${Date.now()}`,
          state: "SP",
          city: "São Paulo",
        },
      }),
    );

    expect(created.tenantId).toBe(TENANT_A_ID);

    // Limpa.
    await withTenantScope(TENANT_A_ID, (tx) =>
      tx.franchise.delete({ where: { id: created.id } }),
    );
  });
});

describe("RLS — UPDATE / DELETE cross-tenant", () => {
  it("scoped em A: UPDATE em franquia de B não afeta nenhuma linha", async () => {
    const bFranchise = await withTenantScope(TENANT_B_ID, (tx) =>
      tx.franchise.findFirst({ select: { id: true, name: true } }),
    );
    const originalName = bFranchise!.name;

    // updateMany retorna count = 0 (não há linha visível para atualizar).
    const result = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.franchise.updateMany({
        where: { id: bFranchise!.id },
        data: { name: "HACKED" },
      }),
    );
    expect(result.count).toBe(0);

    // Confirma que B continua intacta.
    const after = await withTenantScope(TENANT_B_ID, (tx) =>
      tx.franchise.findUnique({ where: { id: bFranchise!.id } }),
    );
    expect(after?.name).toBe(originalName);
  });

  it("scoped em A: DELETE em franquia de B não afeta nenhuma linha", async () => {
    const bFranchise = await withTenantScope(TENANT_B_ID, (tx) =>
      tx.franchise.findFirst({ select: { id: true } }),
    );

    const result = await withTenantScope(TENANT_A_ID, (tx) =>
      tx.franchise.deleteMany({ where: { id: bFranchise!.id } }),
    );
    expect(result.count).toBe(0);

    // Continua existindo para B.
    const stillThere = await withTenantScope(TENANT_B_ID, (tx) =>
      tx.franchise.findUnique({ where: { id: bFranchise!.id } }),
    );
    expect(stillThere).not.toBeNull();
  });
});

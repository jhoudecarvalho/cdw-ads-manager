/**
 * Valida o vínculo polimórfico de AdAccount/Campaign no modo COMPANY,
 * de ponta a ponta — incluindo o fix do sync que propaga `companyId`.
 *
 * Antes do fix, o sync criava Campaign copiando só `franchiseId`; uma conta
 * de empresa produzia Campaign com franchiseId=null + companyId=undefined,
 * violando o CHECK XOR `campaigns_unit_xor`. Este teste pega o tenant
 * `kgepel` (COMPANY), cria uma AdAccount mock vinculada a uma empresa, roda
 * o sync e confirma que as campanhas saem com `companyId` setado.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import { syncAccount } from "@/server/ads/sync";

let tenantId = "";
let companyId = "";
let adAccountId = "";

beforeAll(async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "kgepel" },
    select: { id: true, tenantType: true },
  });
  if (tenant.tenantType !== "COMPANY") {
    throw new Error("Tenant 'kgepel' precisa estar em modo COMPANY. Rode o seed.");
  }
  tenantId = tenant.id;

  const c = await withTenantScope(tenantId, (tx) =>
    tx.company.findFirst({ where: { deletedAt: null }, select: { id: true } }),
  );
  if (!c) throw new Error("Nenhuma empresa em kgepel — rode o seed.");
  companyId = c.id;

  const account = await withTenantScope(tenantId, (tx) =>
    tx.adAccount.create({
      data: {
        tenantId,
        companyId,
        platform: "META_ADS",
        externalAccountId: `test-company-mock-${Date.now()}`,
        status: "CONNECTED",
      },
      select: { id: true },
    }),
  );
  adAccountId = account.id;
});

afterAll(async () => {
  await withTenantScope(tenantId, async (tx) => {
    const campaigns = await tx.campaign.findMany({
      where: { adAccountId },
      select: { id: true },
    });
    const ids = campaigns.map((c) => c.id);
    if (ids.length > 0) {
      await tx.campaignMetricDaily.deleteMany({
        where: { campaignId: { in: ids } },
      });
      await tx.campaign.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.syncLog.deleteMany({ where: { adAccountId } });
    await tx.adAccount.delete({ where: { id: adAccountId } });
  });
});

describe("AdAccount de empresa — sync polimórfico", () => {
  it("conta criada tem companyId setado e franchiseId null", async () => {
    const acc = await withTenantScope(tenantId, (tx) =>
      tx.adAccount.findUniqueOrThrow({
        where: { id: adAccountId },
        select: { franchiseId: true, companyId: true },
      }),
    );
    expect(acc.companyId).toBe(companyId);
    expect(acc.franchiseId).toBeNull();
  });

  it("sync cria campanhas herdando companyId (não quebra o CHECK XOR)", async () => {
    const r = await syncAccount(tenantId, adAccountId);
    expect(r.status).toBe("SUCCESS");
    expect(r.campaigns).toBeGreaterThan(0);

    const campaigns = await withTenantScope(tenantId, (tx) =>
      tx.campaign.findMany({
        where: { adAccountId },
        select: { franchiseId: true, companyId: true },
      }),
    );
    expect(campaigns.length).toBeGreaterThan(0);
    for (const c of campaigns) {
      expect(c.companyId).toBe(companyId);
      expect(c.franchiseId).toBeNull();
    }
  });
});

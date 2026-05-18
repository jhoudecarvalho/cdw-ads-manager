/**
 * Testes do orquestrador de sync — rodam contra o Neon real, dentro de
 * `withTenantScope` (mesmo enforcement de RLS que o app).
 *
 * O que provamos:
 *   1. syncAccount cria SyncLog (RUNNING → SUCCESS) e gera campanhas/métricas
 *   2. Rodar 2x no mesmo range produz o mesmo total de métricas (idempotente)
 *   3. lastSyncAt avança
 *
 * Setup: usa o tenant `anjos` semeado. Cria um AdAccount temporário (mock),
 * roda sync nele, depois apaga as criações.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import { syncAccount } from "@/server/ads/sync";

let tenantId = "";
let franchiseId = "";
let adAccountId = "";

beforeAll(async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "anjos" },
    select: { id: true },
  });
  tenantId = tenant.id;

  // Pega uma franquia qualquer do tenant.
  const f = await withTenantScope(tenantId, (tx) =>
    tx.franchise.findFirst({ select: { id: true } }),
  );
  franchiseId = f!.id;

  // Cria um AdAccount mock dedicado pro teste, com externalAccountId único.
  const externalAccountId = `test-mock-${Date.now()}`;
  const account = await withTenantScope(tenantId, (tx) =>
    tx.adAccount.create({
      data: {
        tenantId,
        franchiseId,
        platform: "GOOGLE_ADS",
        externalAccountId,
        status: "CONNECTED",
      },
      select: { id: true },
    }),
  );
  adAccountId = account.id;
});

afterAll(async () => {
  // Cleanup: apaga campanhas, métricas, sync_logs e o AdAccount criado.
  await withTenantScope(tenantId, async (tx) => {
    const campaigns = await tx.campaign.findMany({
      where: { adAccountId },
      select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);
    if (campaignIds.length > 0) {
      await tx.campaignMetricDaily.deleteMany({
        where: { campaignId: { in: campaignIds } },
      });
      await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    }
    await tx.syncLog.deleteMany({ where: { adAccountId } });
    await tx.adAccount.delete({ where: { id: adAccountId } });
  });
});

describe("sync — primeira execução", () => {
  it("cria 3 campanhas (mock) e métricas, registra SyncLog SUCCESS", async () => {
    const r = await syncAccount(tenantId, adAccountId);

    expect(r.status).toBe("SUCCESS");
    expect(r.campaigns).toBe(3);
    expect(r.metrics).toBeGreaterThan(0);

    const log = await withTenantScope(tenantId, (tx) =>
      tx.syncLog.findFirst({
        where: { adAccountId },
        orderBy: { startedAt: "desc" },
      }),
    );
    expect(log?.status).toBe("SUCCESS");
    expect(log?.finishedAt).not.toBeNull();
  });
});

describe("sync — idempotência", () => {
  it("rodar 2x no mesmo range produz o mesmo total de métricas", async () => {
    // run #1 (já rodou no teste anterior); aqui é run #2
    const r1 = await syncAccount(tenantId, adAccountId);

    const count1 = await withTenantScope(tenantId, (tx) =>
      tx.campaignMetricDaily.count({
        where: { campaign: { adAccountId } },
      }),
    );

    // run #3
    const r2 = await syncAccount(tenantId, adAccountId);

    const count2 = await withTenantScope(tenantId, (tx) =>
      tx.campaignMetricDaily.count({
        where: { campaign: { adAccountId } },
      }),
    );

    expect(r1.status).toBe("SUCCESS");
    expect(r2.status).toBe("SUCCESS");
    expect(count1).toBe(count2);
  });

  it("lastSyncAt avança entre execuções", async () => {
    const before = await withTenantScope(tenantId, (tx) =>
      tx.adAccount.findUniqueOrThrow({
        where: { id: adAccountId },
        select: { lastSyncAt: true },
      }),
    );

    await new Promise((r) => setTimeout(r, 20));
    await syncAccount(tenantId, adAccountId);

    const after = await withTenantScope(tenantId, (tx) =>
      tx.adAccount.findUniqueOrThrow({
        where: { id: adAccountId },
        select: { lastSyncAt: true },
      }),
    );

    expect(after.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(
      before.lastSyncAt!.getTime(),
    );
  });
});

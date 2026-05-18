import { Prisma } from "@/generated/prisma/client";
import { withTenantScope } from "@/server/db/tenant-scope";
import { decryptOptional, encrypt } from "@/server/crypto/tokens";
import { getProvider } from "./factory";
import type { FetchRange, ProviderApiError } from "./provider";

/**
 * Sync orquestra: para cada AdAccount, busca campanhas e métricas no provider
 * e persiste no banco. Idempotente: rodar 2x no mesmo range produz o mesmo
 * estado final.
 *
 * Estratégia anti-duplicata:
 *   - Campanhas → upsert por (adAccountId, externalId)
 *   - Métricas → delete dentro do range + createMany. É a forma mais simples
 *     de garantir que correções no provedor (campanha aparece, depois some,
 *     reaparece com valores diferentes) se reflitam fielmente.
 *
 * Isolamento de erro:
 *   - Erro numa conta não trava as outras — registra em SyncLog FAILED e
 *     segue. Resultado final do tenant pode ser PARTIAL.
 *
 * Tudo dentro de `withTenantScope` — RLS garante que mesmo um bug no
 * orquestrador não cria/atualiza dado em outro tenant.
 */

export type SyncResult = {
  adAccountId: string;
  platform: "GOOGLE_ADS" | "META_ADS";
  status: "SUCCESS" | "FAILED";
  campaigns: number;
  metrics: number;
  error?: string;
};

export type TenantSyncSummary = {
  tenantId: string;
  syncedAccounts: number;
  failedAccounts: number;
  totalCampaigns: number;
  totalMetrics: number;
  results: SyncResult[];
};

const DEFAULT_RANGE_DAYS = 14;

function defaultRange(): FetchRange {
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until);
  since.setUTCDate(until.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
  return { since, until };
}

export async function syncAccount(
  tenantId: string,
  adAccountId: string,
  range: FetchRange = defaultRange(),
): Promise<SyncResult> {
  const account = await withTenantScope(tenantId, (tx) =>
    tx.adAccount.findUnique({
      where: { id: adAccountId },
      select: {
        id: true,
        tenantId: true,
        platform: true,
        externalAccountId: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    }),
  );

  if (!account) {
    throw new Error(`AdAccount ${adAccountId} não encontrado neste tenant.`);
  }

  // Log inicial — marca RUNNING. Se algo crashar antes de fechar, fica como
  // "running stale" e o próximo sync pode reconciliar.
  const logId = await withTenantScope(tenantId, async (tx) => {
    const log = await tx.syncLog.create({
      data: {
        tenantId,
        adAccountId: account.id,
        platform: account.platform,
        status: "RUNNING",
      },
      select: { id: true },
    });
    return log.id;
  });

  try {
    const provider = getProvider(account.platform);
    const creds = {
      externalAccountId: account.externalAccountId,
      accessToken: decryptOptional(account.accessToken),
      refreshToken: decryptOptional(account.refreshToken),
      tokenExpiresAt: account.tokenExpiresAt,
    };

    const campaignsFromApi = await provider.listCampaigns(creds);

    let campaignCount = 0;
    let metricCount = 0;

    // Transação principal do sync — pode acumular muitos upserts/inserts
    // (até centenas por conta). Pool do Neon precisa de maxWait/timeout
    // maiores que o default; sem isso, sync sequencial de vários tenants
    // estoura "Unable to start a transaction in the given time".
    await withTenantScope(
      tenantId,
      async (tx) => {
        // Upsert das campanhas — uma por uma; volume pequeno (3 por conta no
        // mock; algumas dezenas em produção).
        const campaignIdByExternal = new Map<string, string>();
        for (const c of campaignsFromApi) {
          const saved = await tx.campaign.upsert({
            where: {
              adAccountId_externalId: {
                adAccountId: account.id,
                externalId: c.externalId,
              },
            },
            update: {
              name: c.name,
              type: c.type,
              status: c.status,
              startDate: c.startDate,
              endDate: c.endDate,
            },
            create: {
              tenantId,
              franchiseId: (
                await tx.adAccount.findUniqueOrThrow({
                  where: { id: account.id },
                  select: { franchiseId: true },
                })
              ).franchiseId,
              adAccountId: account.id,
              platform: account.platform,
              externalId: c.externalId,
              name: c.name,
              type: c.type,
              status: c.status,
              startDate: c.startDate,
              endDate: c.endDate,
            },
            select: { id: true },
          });
          campaignIdByExternal.set(c.externalId, saved.id);
          campaignCount++;
        }

        // Métricas: pega tudo no range, persiste por delete+createMany.
        const metrics = await provider.getDailyMetrics(creds, range);
        const campaignIds = Array.from(campaignIdByExternal.values());

        if (campaignIds.length > 0) {
          await tx.campaignMetricDaily.deleteMany({
            where: {
              campaignId: { in: campaignIds },
              date: { gte: range.since, lte: range.until ?? new Date() },
            },
          });

          if (metrics.length > 0) {
            const rows: Prisma.CampaignMetricDailyCreateManyInput[] = [];
            for (const m of metrics) {
              const campaignId = campaignIdByExternal.get(m.externalCampaignId);
              if (!campaignId) continue;
              rows.push({
                tenantId,
                campaignId,
                date: m.date,
                spend: m.spend,
                impressions: m.impressions,
                clicks: m.clicks,
                conversions: m.conversions,
                conversionValue: m.conversionValue,
                reach: m.reach ?? null,
                frequency: m.frequency ?? null,
                platformExtras: (m.extras ?? null) as Prisma.InputJsonValue,
              });
            }
            if (rows.length > 0) {
              await tx.campaignMetricDaily.createMany({ data: rows });
              metricCount = rows.length;
            }
          }
        }

        // Tokens podem ter sido renovados implicitamente (no real os providers
        // expõem isso; o mock não). Por ora só atualiza lastSyncAt.
        await tx.adAccount.update({
          where: { id: account.id },
          data: { lastSyncAt: new Date() },
        });

        await tx.syncLog.update({
          where: { id: logId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            recordsProcessed: campaignCount + metricCount,
          },
        });
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    return {
      adAccountId: account.id,
      platform: account.platform,
      status: "SUCCESS",
      campaigns: campaignCount,
      metrics: metricCount,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro desconhecido no sync.";

    await withTenantScope(tenantId, (tx) =>
      tx.syncLog.update({
        where: { id: logId },
        data: { status: "FAILED", finishedAt: new Date(), error: message },
      }),
    ).catch(() => {
      /* swallow — não vamos esconder o erro original. */
    });

    return {
      adAccountId: account.id,
      platform: account.platform,
      status: "FAILED",
      campaigns: 0,
      metrics: 0,
      error: message,
    };
  }
}

export async function syncTenant(
  tenantId: string,
  range: FetchRange = defaultRange(),
): Promise<TenantSyncSummary> {
  const accounts = await withTenantScope(tenantId, (tx) =>
    tx.adAccount.findMany({
      where: { deletedAt: null, status: "CONNECTED" },
      select: { id: true },
    }),
  );

  const results: SyncResult[] = [];
  // Sequencial — manda volume previsível pro Neon e evita bater rate limit.
  // Paralelizável se virar gargalo (Promise.allSettled com limite).
  for (const a of accounts) {
    results.push(await syncAccount(tenantId, a.id, range));
  }

  const synced = results.filter((r) => r.status === "SUCCESS").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const totalCampaigns = results.reduce((s, r) => s + r.campaigns, 0);
  const totalMetrics = results.reduce((s, r) => s + r.metrics, 0);

  return {
    tenantId,
    syncedAccounts: synced,
    failedAccounts: failed,
    totalCampaigns,
    totalMetrics,
    results,
  };
}

// Re-export para conveniência dos consumidores.
export type { ProviderApiError };

/**
 * Helper para cifrar tokens novos antes de gravar (Phase 5+ quando o fluxo
 * OAuth real entrar). Mantido aqui para deixar a dependência explícita.
 */
export function encryptToken(plain: string): string {
  return encrypt(plain);
}

// Reaproveita o helper interno do Prisma para detectar erros conhecidos.
export const isPrismaKnownError = (
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError;

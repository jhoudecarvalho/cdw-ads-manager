import { NextResponse } from "next/server";
import { env } from "@/env";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";

/**
 * Política de retenção — purga periódica de dados além do prazo.
 *
 * Cutoffs (LGPD princípio da minimização — manter apenas o necessário):
 *   - SyncLog: 90 dias (operacional, debug — não precisa de muito histórico)
 *   - AuditLog: 5 anos (prazo padrão para auditoria fiscal/regulatória)
 *   - CampaignMetricDaily: 2 anos (análise histórica + tendências anuais)
 *
 * Estes valores podem virar env vars no futuro. Por ora são constantes.
 *
 * Protegido por Bearer CRON_SECRET, mesmo padrão do /api/cron/sync.
 * Itera por tenant — RLS via withTenantScope (cada delete só apaga o que
 * pertence ao tenant em escopo).
 */

const RETENTION_DAYS = {
  syncLog: 90,
  auditLog: 5 * 365,
  campaignMetric: 2 * 365,
} as const;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado." },
      { status: 503 },
    );
  }
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  });

  const syncCutoff = daysAgo(RETENTION_DAYS.syncLog);
  const auditCutoff = daysAgo(RETENTION_DAYS.auditLog);
  const metricCutoff = daysAgo(RETENTION_DAYS.campaignMetric);

  const startedAt = new Date();
  const results: Array<{
    slug: string;
    ok: boolean;
    purged?: {
      syncLogs: number;
      auditLogs: number;
      campaignMetrics: number;
    };
    error?: string;
  }> = [];

  for (const t of tenants) {
    try {
      const purged = await withTenantScope(t.id, async (tx) => {
        const [syncLogs, auditLogs, campaignMetrics] = await Promise.all([
          tx.syncLog.deleteMany({
            where: { startedAt: { lt: syncCutoff } },
          }),
          tx.auditLog.deleteMany({
            where: { occurredAt: { lt: auditCutoff } },
          }),
          tx.campaignMetricDaily.deleteMany({
            where: { date: { lt: metricCutoff } },
          }),
        ]);
        return {
          syncLogs: syncLogs.count,
          auditLogs: auditLogs.count,
          campaignMetrics: campaignMetrics.count,
        };
      });
      results.push({ slug: t.slug, ok: true, purged });
    } catch (err) {
      results.push({
        slug: t.slug,
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    policy: {
      syncLogDays: RETENTION_DAYS.syncLog,
      auditLogDays: RETENTION_DAYS.auditLog,
      campaignMetricDays: RETENTION_DAYS.campaignMetric,
    },
    tenants: results.length,
    results,
  });
}

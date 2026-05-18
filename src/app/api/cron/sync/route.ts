import { NextResponse } from "next/server";
import { env } from "@/env";
import { prisma } from "@/server/db/prisma";
import { syncTenant } from "@/server/ads/sync";

/**
 * Endpoint chamado por cron externo (Vercel Cron, GitHub Actions, EasyCron…).
 *
 * Protegido por `Authorization: Bearer ${CRON_SECRET}`. O secret vive só no
 * .env e no scheduler — ninguém autenticado no app consegue rodar isso por
 * acidente (e quem já é ADMIN tem o botão "Atualizar agora" pra rodar
 * sob demanda do próprio tenant).
 *
 * Loop por todos os tenants ativos. Falha em um tenant não trava os outros.
 * Resposta agrega o resumo de cada tenant.
 *
 * Em produção: pode ficar pesado. Próximo passo natural é trocar pra uma
 * fila (BullMQ, Trigger.dev, Inngest) — este endpoint vira o "enfileirador".
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;

  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado no servidor." },
      { status: 503 },
    );
  }
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, slug: true },
  });

  const startedAt = new Date();
  const results: Array<{
    slug: string;
    ok: boolean;
    syncedAccounts?: number;
    totalMetrics?: number;
    error?: string;
  }> = [];

  for (const t of tenants) {
    try {
      const summary = await syncTenant(t.id);
      results.push({
        slug: t.slug,
        ok: true,
        syncedAccounts: summary.syncedAccounts,
        totalMetrics: summary.totalMetrics,
      });
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
    tenants: results.length,
    results,
  });
}

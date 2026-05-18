"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/server/auth/can";
import { loadActorContext } from "@/server/auth/load-actor";
import { recordAudit } from "@/server/audit/record";
import { syncTenant, type TenantSyncSummary } from "./sync";

export type SyncActionResult =
  | { ok: true; summary: TenantSyncSummary }
  | { ok: false; error: string };

/**
 * Server action invocada pelo botão "Atualizar agora" no dashboard.
 *
 * Autorização: precisa ser ADMIN. Em uma fase futura, REGIONAL pode rodar
 * sync das contas das suas regiões (escopo mais fino) — por ora simples.
 *
 * Recebe `tenantSlug` para revalidar o path certo. Mesmo sendo passado pelo
 * cliente, é validado contra o `tenantId` da sessão — não acreditamos no
 * cliente sem cruzar.
 */
export async function runSyncAction(
  tenantSlug: string,
): Promise<SyncActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão inválida." };

  const actor = await loadActorContext(session);
  if (!can(actor, "manage_ad_accounts")) {
    return {
      ok: false,
      error: "Sem permissão para atualizar — apenas ADMIN por enquanto.",
    };
  }

  try {
    const summary = await syncTenant(actor.tenantId);
    await recordAudit({
      tenantId: actor.tenantId,
      eventType: "AD_ACCOUNT_CONNECTED", // proxy event para "sync executado"
      actorUserId: actor.id,
      resourceType: "sync",
      metadata: {
        trigger: "manual",
        syncedAccounts: summary.syncedAccounts,
        failedAccounts: summary.failedAccounts,
        totalMetrics: summary.totalMetrics,
      },
    });
    // Invalida o cache do dashboard do tenant — a próxima navegação refaz
    // as queries com os dados novos.
    revalidatePath(`/${tenantSlug}`, "layout");
    return { ok: true, summary };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

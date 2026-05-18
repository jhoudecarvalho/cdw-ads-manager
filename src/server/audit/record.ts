import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import type { AuditEventType } from "@/generated/prisma/client";
import { withTenantScope } from "@/server/db/tenant-scope";

/**
 * Helper único de escrita na trilha de auditoria (LGPD).
 *
 * Princípios:
 *   1. **Failsafe** — falhar aqui NÃO pode quebrar a ação principal do
 *      usuário. Engole o erro e segue (loga no console pra debug). Auditoria
 *      é importante mas não pode bloquear o login do usuário, por exemplo.
 *   2. **Imutável** — só insert, nunca update/delete. A retenção
 *      (`/api/cron/retention`) é o único caminho que remove linhas, e só
 *      após o período de retenção configurado.
 *   3. **Com RLS** — o app role (`franchise_hub_app`) tem NOBYPASSRLS, então
 *      a escrita precisa passar por `withTenantScope`. O `tenantId` no input
 *      é obrigatório — quem chama precisa saber em qual tenant o evento
 *      ocorre antes de gravar. Para tentativa de login com email
 *      inexistente, registramos no tenant do `tenantSlug` informado no form
 *      (já validado).
 *
 * IP/UserAgent: capturados do header da request quando possível (precisa
 * estar dentro de um request context — Server Action, Route Handler, etc.).
 * Em contextos sem request (cron, jobs), passe `ip`/`userAgent` no input.
 */

export type AuditInput = {
  tenantId: string;
  eventType: AuditEventType;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Override quando não há request context. */
  ip?: string | null;
  userAgent?: string | null;
};

async function captureRequestContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    const userAgent = h.get("user-agent") ?? null;
    return { ip, userAgent };
  } catch {
    // Não está em um request — cron/jobs caem aqui.
    return { ip: null, userAgent: null };
  }
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    let ip = input.ip ?? null;
    let userAgent = input.userAgent ?? null;
    if (ip === null && userAgent === null) {
      const ctx = await captureRequestContext();
      ip = ctx.ip;
      userAgent = ctx.userAgent;
    }

    await withTenantScope(input.tenantId, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          eventType: input.eventType,
          actorUserId: input.actorUserId ?? null,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          metadata: input.metadata,
          ipAddress: ip,
          userAgent,
        },
      }),
    );
  } catch (err) {
    // Não propagar — auditoria não pode travar a ação principal.
    console.error("[audit] falhou ao gravar:", err);
  }
}

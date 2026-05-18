import { createHash } from "node:crypto";
import { withTenantScope } from "@/server/db/tenant-scope";
import { recordAudit } from "@/server/audit/record";

/**
 * LGPD Art. 18 — direito à exclusão / anonimização.
 *
 * Escolhemos **anonimizar** em vez de hard-delete porque:
 *   - Preservamos integridade referencial (vínculos UserFranchise, AuditLog
 *     com actorUserId etc.) sem cascade-delete que apagaria histórico de
 *     auditoria.
 *   - Atendemos ao espírito da lei: PII vira opaco, o usuário não é mais
 *     identificável a partir da nossa base.
 *   - Trilha de auditoria (LGPD também exige) fica preservada — sabemos que
 *     "alguém" fez tal ação, sem saber QUEM.
 *
 * Após anonimização:
 *   - `email` vira `anonymized_{hash}@removed.invalid`
 *   - `name`, `passwordHash`, `lastLoginAt` → null
 *   - `deletedAt` = now (soft-delete sinaliza "não usar")
 *   - O usuário não consegue mais logar (passwordHash null + deletedAt set)
 *
 * O `hash` no email é o sha256 do (userId + tenantId), só pra garantir
 * unicidade sem ser reversível.
 */

export type AnonymizeResult = {
  userId: string;
  email: string;
  anonymizedAt: string;
};

export async function anonymizeUser(
  tenantId: string,
  userId: string,
  reason: string,
): Promise<AnonymizeResult> {
  const hash = createHash("sha256")
    .update(`${userId}:${tenantId}`)
    .digest("hex")
    .slice(0, 16);
  const anonymizedEmail = `anonymized_${hash}@removed.invalid`;
  const now = new Date();

  await withTenantScope(tenantId, (tx) =>
    tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: null,
        passwordHash: null,
        lastLoginAt: null,
        deletedAt: now,
      },
    }),
  );

  // Trilha de auditoria — registra que a anonimização aconteceu (não o
  // email original, claro).
  await recordAudit({
    tenantId,
    eventType: "DATA_DELETED",
    actorUserId: userId,
    resourceType: "user",
    resourceId: userId,
    metadata: { reason, anonymizedAt: now.toISOString() },
  });

  return { userId, email: anonymizedEmail, anonymizedAt: now.toISOString() };
}

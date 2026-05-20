import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import { recordAudit } from "@/server/audit/record";

/**
 * Revoga todas as conexões Meta feitas por um usuário do Facebook, em todos
 * os tenants. Acionado pelo Data Deletion Callback da Meta — que chega sem
 * contexto de tenant, só com o `user_id` do Facebook.
 *
 * "Revogar" = soft-delete da AdAccount + limpar os tokens (o dado pessoal
 * sensível). As campanhas/métricas (dados da conta de anúncio, não do
 * usuário) ficam, mas a conta some das listas e do sync.
 *
 * Itera tenant a tenant via `withTenantScope` — sem BYPASSRLS, mesma postura
 * das queries do super admin. A tabela `Tenant` não tem RLS, então a
 * listagem é direta.
 */
export async function revokeMetaConnectionsByUser(
  metaUserId: string,
): Promise<{ revoked: number }> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  let revoked = 0;

  for (const t of tenants) {
    const affected = await withTenantScope(t.id, async (tx) => {
      const accounts = await tx.adAccount.findMany({
        where: {
          platform: "META_ADS",
          connectedExternalUserId: metaUserId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (accounts.length === 0) return 0;

      await tx.adAccount.updateMany({
        where: {
          platform: "META_ADS",
          connectedExternalUserId: metaUserId,
          deletedAt: null,
        },
        data: {
          status: "REVOKED",
          deletedAt: new Date(),
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        },
      });
      return accounts.length;
    });

    if (affected > 0) {
      revoked += affected;
      await recordAudit({
        tenantId: t.id,
        eventType: "AD_ACCOUNT_DISCONNECTED",
        resourceType: "ad_account",
        metadata: {
          reason: "meta_data_deletion",
          externalUserId: metaUserId,
          revoked: affected,
        },
      });
    }
  }

  return { revoked };
}

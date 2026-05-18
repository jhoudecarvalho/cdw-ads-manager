import { withTenantScope } from "@/server/db/tenant-scope";

/**
 * LGPD Art. 15 — direito de acesso aos dados.
 *
 * Compila tudo que temos sobre o titular: perfil, vínculos, aceites,
 * trilha de auditoria das ações dele. Não inclui métricas de campanhas
 * (são dados da franqueadora, não do titular pessoa física).
 *
 * Retorna JSON — quem chama serializa pra download. Inclui `exportedAt`
 * pra evidenciar a data da extração.
 */
export async function exportUserData(tenantId: string, userId: string) {
  return withTenantScope(tenantId, async (tx) => {
    const [user, termsAcceptances, franchises, regions, auditLogs] =
      await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            emailVerified: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
        }),
        tx.termsAcceptance.findMany({
          where: { userId },
          select: {
            documentKey: true,
            version: true,
            acceptedAt: true,
            ipAddress: true,
            userAgent: true,
          },
          orderBy: { acceptedAt: "desc" },
        }),
        tx.userFranchise.findMany({
          where: { userId },
          select: {
            franchiseId: true,
            createdAt: true,
            franchise: { select: { name: true, city: true, state: true } },
          },
        }),
        tx.userRegion.findMany({
          where: { userId },
          select: {
            regionId: true,
            createdAt: true,
            region: { select: { name: true } },
          },
        }),
        tx.auditLog.findMany({
          where: { actorUserId: userId },
          select: {
            eventType: true,
            resourceType: true,
            resourceId: true,
            metadata: true,
            ipAddress: true,
            userAgent: true,
            occurredAt: true,
          },
          orderBy: { occurredAt: "desc" },
          take: 1000, // últimas 1000 ações, evita dump gigante
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      tenantId,
      profile: user,
      termsAcceptances,
      franchiseAssignments: franchises,
      regionAssignments: regions,
      activityLog: auditLogs,
    };
  });
}

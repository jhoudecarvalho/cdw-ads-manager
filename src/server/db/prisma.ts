import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton do PrismaClient. Em dev, o hot reload do Next instancia o módulo
 * várias vezes — guardamos a referência no `globalThis` para não vazar
 * conexões. Em prod, cada container roda uma única instância.
 *
 * Prisma 7 exige um driver adapter — usamos `@prisma/adapter-pg` (node-postgres).
 *
 * IMPORTANTE: este client é "cru". Para acessar tabelas de negócio sempre
 * passe por `withTenantScope` (src/server/db/tenant-scope.ts), que define o
 * `app.current_tenant_id` exigido pelas policies de Row-Level Security.
 */
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import { prisma } from "./prisma";
import type { PrismaClient } from "@/generated/prisma/client";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Executa um callback dentro de uma transação onde a variável de sessão
 * `app.current_tenant_id` está definida. As policies de RLS dos modelos de
 * negócio filtram por essa variável — então qualquer SELECT/UPDATE/DELETE
 * feito dentro do callback vê apenas dados do tenant indicado.
 *
 * REGRA DE OURO: nenhuma rota deve usar `prisma` diretamente para tabelas com
 * `tenantId`. Toda query passa por aqui. Quem traz o `tenantId` é sempre o
 * servidor (sessão do usuário + slug do path), nunca o cliente.
 *
 * Usamos `set_config(name, value, is_local := true)` em vez de `SET LOCAL`
 * porque `set_config` aceita o valor como parâmetro — protege contra injeção
 * caso o `tenantId` chegasse "sujo" (não deveria, mas defesa em camadas).
 *
 * Na Fase 3 chegam os modelos de negócio + a migration que habilita RLS.
 * Hoje (Fase 1) só existe o `Tenant`, que NÃO tem RLS porque é a fonte da
 * verdade do tenant — quem o lê é o resolvedor de tenant, não o app.
 */
export type TenantScopeOptions = {
  /** ms para esperar por uma conexão livre do pool. Default 5000. */
  maxWait?: number;
  /** ms máximos para a transação executar. Default 10000. */
  timeout?: number;
};

export async function withTenantScope<T>(
  tenantId: string,
  callback: (tx: TxClient) => Promise<T>,
  opts: TenantScopeOptions = {},
): Promise<T> {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("withTenantScope: tenantId obrigatório.");
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return callback(tx);
    },
    {
      // Defaults mais folgados que os 2s/5s do Prisma — sync com muitos
      // upserts via pooler precisa de margem. Rotas de página/dashboard
      // chamam sem opts e ainda assim ganham mais respiro.
      maxWait: opts.maxWait ?? 5_000,
      timeout: opts.timeout ?? 10_000,
    },
  );
}

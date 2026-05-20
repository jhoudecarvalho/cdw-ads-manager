import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { readImpersonation } from "@/server/super-admin/impersonation";
import { getTenantBySlug } from "@/server/tenant/resolver";
import type { ActorContext } from "./can";
import { loadActorContext } from "./load-actor";

/**
 * Carrega o ActorContext em pages dentro de `[slug]/(app)/`.
 *
 * O layout do grupo já chama `redirect(/:slug/login)` quando a sessão é
 * null, mas o React Server Components renderiza pages em paralelo com
 * o layout — uma request sem sessão chega em `loadActorContext` antes
 * do redirect do layout abortar a árvore, e o guard de defesa em
 * `load-actor.ts` lança "loadActorContext chamado sem sessão válida".
 *
 * O helper duplica o guard do layout (redirect → /:slug/login) e devolve
 * o ActorContext já carregado. Pages ficam com uma linha em vez de três
 * e somem os `loadActorContext(session!)` espalhados pelo repo.
 *
 * SUPER_ADMIN impersonando: a sessão do super admin aponta pro tenant
 * `__system__` (sem dados de negócio). Numa rota `/[slug]/`, porém, o tenant
 * efetivo é sempre o tenant do slug — validado pelo cookie de impersonação,
 * a mesma checagem que o layout faz. Sem re-escopar `tenantId`/`tenantType`
 * aqui, `loadOverview(actor.tenantId, ...)`, `getTenantModule(actor.tenantType)`
 * e os guards de COMPANY/FRANCHISE rodavam contra o `__system__` e o dashboard
 * inteiro vinha zerado. Re-escopamos só no caminho das pages: a área `/admin`
 * usa `loadActorContext` direto e continua enxergando o `__system__`.
 */
export async function requireActor(slug: string): Promise<ActorContext> {
  const session = await auth();
  if (!session?.user) redirect(`/${slug}/login`);

  const actor = await loadActorContext(session);

  if (actor.role === "SUPER_ADMIN") {
    const [imp, tenant] = await Promise.all([
      readImpersonation(),
      getTenantBySlug(slug),
    ]);
    if (!tenant || !imp || imp.tenantId !== tenant.id) redirect("/admin");
    return { ...actor, tenantId: tenant.id, tenantType: tenant.tenantType };
  }

  return actor;
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { readImpersonation } from "@/server/super-admin/impersonation";
import { getTenantBySlug } from "@/server/tenant/resolver";
import type { ActorContext } from "./can";
import { loadActorContext } from "./load-actor";

/**
 * Re-escopo de SUPER_ADMIN para o tenant de uma rota `/[slug]/`.
 *
 * A sessão do super admin aponta pro tenant `__system__` (sem dados de
 * negócio). Numa rota de tenant, o tenant efetivo é sempre o do slug —
 * validado pelo cookie de impersonação (a mesma checagem do layout). Retorna
 * o actor re-escopado, ou `null` se a impersonação não casa com o slug.
 *
 * Para roles normais, devolve o actor inalterado.
 */
async function rescopeForSlug(
  slug: string,
  actor: ActorContext,
): Promise<ActorContext | null> {
  if (actor.role !== "SUPER_ADMIN") return actor;

  const [imp, tenant] = await Promise.all([
    readImpersonation(),
    getTenantBySlug(slug),
  ]);
  if (!tenant || !imp || imp.tenantId !== tenant.id) return null;
  return { ...actor, tenantId: tenant.id, tenantType: tenant.tenantType };
}

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
 * SUPER_ADMIN impersonando: re-escopa `tenantId`/`tenantType` pro tenant do
 * slug (ver `rescopeForSlug`). Sem isso, `loadOverview(actor.tenantId, ...)`,
 * `getTenantModule(actor.tenantType)` e os guards de COMPANY/FRANCHISE
 * rodavam contra o `__system__` e o dashboard inteiro vinha zerado. A área
 * `/admin` usa `loadActorContext` direto e continua enxergando o `__system__`.
 */
export async function requireActor(slug: string): Promise<ActorContext> {
  const session = await auth();
  if (!session?.user) redirect(`/${slug}/login`);

  const actor = await loadActorContext(session);
  const scoped = await rescopeForSlug(slug, actor);
  if (!scoped) redirect("/admin");
  return scoped;
}

export type ResolveActorResult =
  | { ok: true; actor: ActorContext }
  | { ok: false; error: string };

/**
 * Variante para **Server Actions** dentro de `[slug]/(app)/`. Mesmo re-escopo
 * do `requireActor`, mas retorna `{ ok: false, error }` em vez de
 * `redirect()` — actions devolvem um FormState e tratam o erro na UI.
 *
 * Por que existe: actions usavam `loadActorContext(session)` + `actor.tenantId`
 * direto. Para um SUPER_ADMIN impersonando, `actor.tenantId` é `__system__`,
 * então `withTenantScope(actor.tenantId)` não enxerga as unidades do tenant
 * alvo e a ação falha ("não encontrada"). Resolver pelo slug conserta isso de
 * forma consistente com as pages (espelha o fix do PR #7, que só cobriu o
 * caminho de leitura via `requireActor`).
 */
export async function resolveActorForSlug(
  slug: string,
): Promise<ResolveActorResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };

  const actor = await loadActorContext(session);
  const scoped = await rescopeForSlug(slug, actor);
  if (!scoped) {
    return {
      ok: false,
      error: "Sessão de super admin sem impersonação válida para este tenant.",
    };
  }
  return { ok: true, actor: scoped };
}

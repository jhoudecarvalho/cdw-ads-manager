import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
 */
export async function requireActor(slug: string): Promise<ActorContext> {
  const session = await auth();
  if (!session?.user) redirect(`/${slug}/login`);
  return loadActorContext(session);
}

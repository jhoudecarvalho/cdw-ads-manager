import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/server/auth/can";
import { resolveActorForSlug } from "@/server/auth/require-actor";
import { buildAuthUrl, signState } from "@/server/ads/meta-oauth";

/**
 * Início do OAuth Meta. Recebe `?slug=&unitId=`, valida sessão + permissão,
 * assina o `state` com o contexto e redireciona pro dialog do Facebook.
 *
 * GET (não POST) porque é uma navegação top-level iniciada por link/botão.
 * O `state` assinado é a proteção CSRF do callback.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const unitId = url.searchParams.get("unitId");

  if (!slug || !unitId) {
    return NextResponse.json(
      { error: "Parâmetros slug e unitId são obrigatórios." },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL(`/${slug}/login`, url.origin));
  }

  // Re-escopo pro tenant do slug (cobre super admin impersonando) + autorização.
  const resolved = await resolveActorForSlug(slug);
  if (!resolved.ok) {
    return NextResponse.redirect(new URL(`/${slug}/login`, url.origin));
  }
  const actor = resolved.actor;

  const authorized =
    actor.tenantType === "COMPANY"
      ? can(actor, "manage_ad_accounts", { tenantId: actor.tenantId })
      : can(actor, "manage_ad_accounts", {
          tenantId: actor.tenantId,
          franchiseId: unitId,
        });
  if (!authorized) {
    return NextResponse.redirect(
      new URL(`/${slug}/campanhas/contas?error=forbidden`, url.origin),
    );
  }

  const state = signState({ slug, unitId });
  return NextResponse.redirect(buildAuthUrl(state));
}

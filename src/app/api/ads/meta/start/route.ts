import { NextResponse } from "next/server";
import { env } from "@/env";
import { auth } from "@/auth";
import { can } from "@/server/auth/can";
import { resolveActorForSlug } from "@/server/auth/require-actor";
import { appBaseUrl, buildAuthUrl, signState } from "@/server/ads/meta-oauth";

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

  // Sem credenciais não adianta ir pro Meta (ele responde "ID do app
  // inválido"). Falha cedo com erro claro na própria tela de Contas.
  if (!env.META_ADS_CLIENT_ID || !env.META_ADS_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL(`/${slug}/campanhas/contas?error=meta_not_configured`, appBaseUrl()),
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL(`/${slug}/login`, appBaseUrl()));
  }

  // Re-escopo pro tenant do slug (cobre super admin impersonando) + autorização.
  const resolved = await resolveActorForSlug(slug);
  if (!resolved.ok) {
    return NextResponse.redirect(new URL(`/${slug}/login`, appBaseUrl()));
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
      new URL(`/${slug}/campanhas/contas?error=forbidden`, appBaseUrl()),
    );
  }

  const state = signState({ slug, unitId });
  return NextResponse.redirect(buildAuthUrl(state));
}

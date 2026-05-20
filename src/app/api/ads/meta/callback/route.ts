import { NextResponse } from "next/server";
import {
  appBaseUrl,
  exchangeCodeForToken,
  exchangeForLongLived,
  fetchMetaUserId,
  listUserAdAccounts,
  MetaOAuthError,
  verifyState,
} from "@/server/ads/meta-oauth";
import { setMetaPending } from "@/server/ads/meta-pending";

/**
 * Callback do OAuth Meta. URL fixa registrada no app Meta como Valid OAuth
 * Redirect URI: `<NEXTAUTH_URL>/api/ads/meta/callback`.
 *
 * Fluxo: valida `state` → troca `code` por token short-lived → troca por
 * long-lived → lista ad accounts do usuário → grava cookie cifrado e manda
 * pra tela de seleção. Não cria AdAccount aqui (o usuário ainda vai escolher
 * qual conta vincular).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Usuário cancelou o consentimento no dialog do Meta.
  if (oauthError) {
    const slug = stateRaw ? verifyState(stateRaw)?.slug : null;
    const dest = slug ? `/${slug}/campanhas/contas?error=cancelled` : "/";
    return NextResponse.redirect(new URL(dest, appBaseUrl()));
  }

  if (!code || !stateRaw) {
    return NextResponse.json({ error: "code/state ausentes." }, { status: 400 });
  }

  const state = verifyState(stateRaw);
  if (!state) {
    return NextResponse.json(
      { error: "state inválido ou expirado." },
      { status: 400 },
    );
  }

  try {
    const shortToken = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLived(shortToken);
    const [metaUserId, accounts] = await Promise.all([
      fetchMetaUserId(longLived.token),
      listUserAdAccounts(longLived.token),
    ]);

    await setMetaPending({
      slug: state.slug,
      unitId: state.unitId,
      token: longLived.token,
      expiresAt: longLived.expiresAt.toISOString(),
      metaUserId,
      accounts,
    });

    return NextResponse.redirect(
      new URL(`/${state.slug}/campanhas/contas/conectar/meta`, appBaseUrl()),
    );
  } catch (err) {
    const msg =
      err instanceof MetaOAuthError
        ? err.message
        : "Falha ao conectar com o Meta.";
    return NextResponse.redirect(
      new URL(
        `/${state.slug}/campanhas/contas?error=${encodeURIComponent(msg)}`,
        appBaseUrl(),
      ),
    );
  }
}

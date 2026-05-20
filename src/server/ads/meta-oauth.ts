import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/**
 * Fluxo OAuth da Meta Marketing API (Facebook Login para apps de Ads).
 *
 * Etapas:
 *   1. `buildAuthUrl` → redireciona o usuário pro dialog de consentimento.
 *   2. Meta volta no `redirectUri` com `?code=&state=`.
 *   3. `exchangeCodeForToken` → token short-lived (~1-2h).
 *   4. `exchangeForLongLived` → token long-lived (~60 dias).
 *   5. `listUserAdAccounts` → contas de anúncio que o usuário administra.
 *
 * O `state` é assinado (HMAC-SHA256 com AUTH_SECRET) e carrega o contexto
 * que precisamos no callback: slug do tenant + unidade alvo + nonce + exp.
 * Protege contra CSRF e contra adulteração do destino do vínculo.
 */

export const META_API_VERSION = "v23.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;
const DIALOG = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`;

/** Permissões mínimas para ler campanhas e métricas. */
const SCOPES = ["ads_read"];

const STATE_TTL_SECONDS = 600; // 10 min entre /start e /callback.

export type OAuthState = {
  slug: string;
  unitId: string;
  nonce: string;
  exp: number;
};

function secret(): string {
  const s = env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET é obrigatório para o OAuth do Meta.");
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from((s + pad).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signState(input: {
  slug: string;
  unitId: string;
}): string {
  const payload: OAuthState = {
    slug: input.slug,
    unitId: input.unitId,
    nonce: b64url(randomBytes(12)),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(token: string): OAuthState | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  if (sig.length !== expected.length) return null;
  if (
    !timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expected, "utf-8"))
  ) {
    return null;
  }
  try {
    const p = JSON.parse(b64urlDecode(body).toString("utf-8")) as OAuthState;
    if (
      typeof p.slug !== "string" ||
      typeof p.unitId !== "string" ||
      typeof p.exp !== "number" ||
      p.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

/** Monta a base URL pública do app para o redirect_uri. */
export function appBaseUrl(): string {
  const raw = env.NEXTAUTH_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function metaRedirectUri(): string {
  return `${appBaseUrl()}/api/ads/meta/callback`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.META_ADS_CLIENT_ID ?? "",
    redirect_uri: metaRedirectUri(),
    state,
    scope: SCOPES.join(","),
    response_type: "code",
  });
  return `${DIALOG}?${params.toString()}`;
}

/** Erro do fluxo OAuth — mensagem amigável já formatada. */
export class MetaOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaOAuthError";
  }
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as
    | T
    | { error?: { message?: string; type?: string } };
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg =
      (json as { error?: { message?: string } }).error?.message ??
      `Graph API retornou ${res.status}`;
    throw new MetaOAuthError(msg);
  }
  return json as T;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>(
    "/oauth/access_token",
    {
      client_id: env.META_ADS_CLIENT_ID ?? "",
      client_secret: env.META_ADS_CLIENT_SECRET ?? "",
      redirect_uri: metaRedirectUri(),
      code,
    },
  );
  return data.access_token;
}

export type LongLivedToken = { token: string; expiresAt: Date };

export async function exchangeForLongLived(
  shortToken: string,
): Promise<LongLivedToken> {
  const data = await graphGet<{ access_token: string; expires_in?: number }>(
    "/oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: env.META_ADS_CLIENT_ID ?? "",
      client_secret: env.META_ADS_CLIENT_SECRET ?? "",
      fb_exchange_token: shortToken,
    },
  );
  // Long-lived costuma vir com ~5184000s (60 dias). Fallback 55 dias.
  const expiresIn = data.expires_in ?? 55 * 24 * 3600;
  return {
    token: data.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/**
 * ID do usuário Meta (Facebook) dono do token. Guardado na AdAccount como
 * `connectedExternalUserId` para o Data Deletion Callback localizar e revogar
 * as contas conectadas por esse usuário.
 */
export async function fetchMetaUserId(token: string): Promise<string> {
  const data = await graphGet<{ id: string }>("/me", {
    fields: "id",
    access_token: token,
  });
  return data.id;
}

export type MetaAdAccountOption = {
  /** ID com prefixo `act_` — é o que a Marketing API usa nos endpoints. */
  externalAccountId: string;
  name: string;
};

/**
 * Valida e decodifica o `signed_request` que a Meta envia no Data Deletion
 * Callback. Formato: `<base64url(sig)>.<base64url(payload)>`, onde
 * `sig = HMAC-SHA256(payloadBase64, APP_SECRET)`. Retorna o payload (com
 * `user_id`) só se a assinatura confere; senão `null` (request forjada).
 */
export function parseSignedRequest(
  signed: string,
): { user_id?: string; algorithm?: string } | null {
  const dot = signed.indexOf(".");
  if (dot < 0) return null;
  const sigB64 = signed.slice(0, dot);
  const payloadB64 = signed.slice(dot + 1);

  const appSecret = env.META_ADS_CLIENT_SECRET;
  if (!appSecret) return null;

  const expected = createHmac("sha256", appSecret).update(payloadB64).digest();
  const actual = b64urlDecode(sigB64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(b64urlDecode(payloadB64).toString("utf-8"));
  } catch {
    return null;
  }
}

export async function listUserAdAccounts(
  token: string,
): Promise<MetaAdAccountOption[]> {
  const data = await graphGet<{
    data: Array<{ id: string; account_id: string; name: string }>;
  }>("/me/adaccounts", {
    fields: "id,account_id,name",
    access_token: token,
    limit: "200",
  });
  return data.data.map((a) => ({
    // `id` já vem como "act_<account_id>".
    externalAccountId: a.id,
    name: a.name || a.account_id,
  }));
}

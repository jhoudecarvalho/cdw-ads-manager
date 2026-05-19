import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Impersonação de tenant pelo SUPER_ADMIN.
 *
 * Mecanismo: cookie HttpOnly assinado com HMAC-SHA256 (chave: AUTH_SECRET).
 * O cookie carrega apenas `{ tenantId, exp }` — não substitui a sessão.
 *
 * Por que cookie e não mexer no JWT da sessão:
 *   - JWT é o "quem sou" — manter intacto preserva auditoria e logout.
 *   - Cookie de impersonação é o "quem estou olhando" — pode ser limpo
 *     instantaneamente sem invalidar a sessão.
 *   - Validação cruzada: o layout `[slug]/(app)` só aceita o cookie quando
 *     `session.user.role === "SUPER_ADMIN"`. Nunca confiar só no cookie.
 *
 * RLS continua sendo a defesa final — toda query usa
 * `withTenantScope(effectiveTenantId)`. Esse helper só sinaliza qual tenant.
 */

const COOKIE_NAME = "fh_impersonation";
const TTL_SECONDS = 60 * 60; // 1h — força "re-entrar como" se passar.

type Payload = {
  tenantId: string;
  /** Unix seconds. */
  exp: number;
};

function getSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) {
    // Em dev sem secret cairíamos num HMAC fraco — recusar é mais seguro
    // do que assinar com uma string vazia conhecida.
    throw new Error(
      "AUTH_SECRET (ou NEXTAUTH_SECRET) é obrigatório para impersonação.",
    );
  }
  return s;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const std = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(std, "base64");
}

function sign(payload: Payload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = base64url(
    createHmac("sha256", getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

function verify(token: string): Payload | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = base64url(
    createHmac("sha256", getSecret()).update(body).digest(),
  );
  // timingSafeEqual exige tamanhos iguais.
  if (sig.length !== expected.length) return null;
  if (
    !timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expected, "utf-8"))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64urlDecode(body).toString("utf-8")) as
      | Payload
      | { tenantId: unknown; exp: unknown };
    if (
      typeof parsed.tenantId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { tenantId: parsed.tenantId, exp: parsed.exp };
  } catch {
    return null;
  }
}

/**
 * Define o cookie de impersonação no response. Chamar de Server Action após
 * `can(actor, "impersonate_tenant", ...)`.
 */
export async function setImpersonationCookie(tenantId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = sign({ tenantId, exp });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/** Limpa o cookie — encerra impersonação. */
export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Lê e valida o cookie. Retorna `null` se ausente, expirado ou assinatura
 * inválida — em qualquer um desses casos, é como se não houvesse impersonação.
 */
export async function readImpersonation(): Promise<{
  tenantId: string;
} | null> {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  if (!c?.value) return null;
  const p = verify(c.value);
  return p ? { tenantId: p.tenantId } : null;
}

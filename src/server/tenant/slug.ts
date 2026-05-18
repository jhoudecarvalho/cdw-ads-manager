/**
 * Validação pura do slug do tenant — sem imports do banco. Pode ser usada
 * tanto no proxy (que evita data-fetching) quanto em testes unitários
 * isolados.
 */

/**
 * Formato aceito: começa com letra, 2–63 caracteres, apenas minúsculas,
 * dígitos e hífen. Casa com regras de DNS-label.
 */
export const TENANT_SLUG_REGEX = /^[a-z][a-z0-9-]{1,62}$/;

/**
 * Slugs reservados — colidem com rotas internas, área pública do produto ou
 * convenções do Next.js.
 */
const RESERVED_SLUGS = new Set([
  "api",
  "_next",
  "admin",
  "login",
  "logout",
  "signup",
  "auth",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function isValidTenantSlug(slug: string): boolean {
  return TENANT_SLUG_REGEX.test(slug) && !RESERVED_SLUGS.has(slug);
}

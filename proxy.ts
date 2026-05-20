import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidTenantSlug } from "@/server/tenant/slug";

/**
 * Proxy do Next.js 16 (substituiu o "middleware" das versões anteriores).
 *
 * Responsabilidade: extrair o slug do tenant do primeiro segmento do path,
 * validar o formato e propagar via header `x-tenant-slug` para os layouts e
 * route handlers. NÃO faz lookup no banco — os docs do Next.js desencorajam
 * dataa-fetching no proxy. A consulta real do Tenant acontece em
 * `app/[slug]/layout.tsx`, cacheada por request via `react.cache()`.
 *
 * Slug com formato inválido = 404 imediato (sem ir ao banco).
 * Slug com formato válido = passa adiante; o layout decide se existe.
 *
 * Paths excluídos pelo `matcher` abaixo: api, assets do Next, arquivos
 * estáticos comuns.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apenas root "/" — landing pública, sem tenant.
  if (pathname === "/") return NextResponse.next();

  const firstSegment = pathname.split("/")[1] ?? "";

  // Formato inválido → 404 amigável (rota não-tenant).
  if (firstSegment && !isValidTenantSlug(firstSegment)) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", firstSegment);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Tudo, exceto: api, _next, favicon, sitemap, robots, páginas públicas
    // estáticas (privacidade, data-deletion) e arquivos com extensão.
    // As páginas públicas são rotas reais top-level — sem essa exclusão, o
    // proxy as trataria como slug de tenant (reservado → inválido) e
    // reescreveria pra /404.
    "/((?!api|_next/static|_next/image|privacidade|data-deletion|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};

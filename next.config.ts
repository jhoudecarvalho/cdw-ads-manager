import type { NextConfig } from "next";
import path from "node:path";

/**
 * Content-Security-Policy do app.
 *
 * - `default-src 'self'` — só carrega assets do próprio domínio.
 * - `script-src` — em dev precisa de 'unsafe-eval' e 'unsafe-inline' (HMR
 *   do Next/Turbopack); em prod só 'self' + nonces seria o ideal, mas
 *   Next 16 ainda não tem nonce-per-render fácil, então mantemos
 *   'unsafe-inline' (CSP fraco mas funcional). Quando o suporte a nonce
 *   amadurecer, restringir.
 * - `connect-src` — Auth.js bate em `/api/auth/*` (mesma origem), Recharts
 *   client-side só renderiza. Habilitamos 'self' e nada externo por ora.
 * - `frame-ancestors 'none'` — proibido embed em iframe (defesa anti-
 *   clickjacking, sobrepõe X-Frame-Options).
 * - `form-action 'self'` — forms só postam de volta pro próprio domínio.
 *
 * Quando OAuth real entrar (Fase 5+), adicionar `accounts.google.com` e
 * `www.facebook.com` em `frame-src` para o popup OAuth.
 */
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'", // Tailwind v4 inline styles e Recharts inline
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:", // ws para HMR em dev; harmless em prod
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Empacota apenas os arquivos necessários em `.next/standalone/` com um
  // `server.js` próprio — usado pela imagem Docker (Fase 9). Sem isso, o
  // runner precisaria de todo o node_modules. Com Prisma 7 + driver adapter
  // (`@prisma/adapter-pg`), não há query engine nativo, então o trace
  // padrão já cobre tudo que importamos.
  output: "standalone",

  turbopack: {
    root: path.resolve(__dirname),
  },

  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      { key: "Content-Security-Policy", value: CSP },
      // HSTS — só faz sentido em prod com HTTPS de verdade. 2 anos +
      // includeSubDomains + preload é o nível "estrito" recomendado para
      // SaaS. Em dev sem TLS o browser ignora.
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;

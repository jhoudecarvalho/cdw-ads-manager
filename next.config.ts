import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fixa a raiz do projeto — há outro package-lock.json em /Documents que
  // confunde a inferência automática do Turbopack.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Cabeçalhos de segurança básicos. CSP completo + HSTS entram na Fase 7.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

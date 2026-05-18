# syntax=docker/dockerfile:1.7
# =========================================================================
# Franchise HUB — imagem de produção (Fase 9)
#
# 4 stages:
#   1. deps      — npm ci (dev + prod) — base pro build e pras ops
#   2. builder   — prisma generate + next build (output: "standalone")
#   3. runner    — imagem mínima, só com .next/standalone + public + static
#   4. ops       — imagem irmã com tsx + prisma CLI pra rodar bootstrap.sh
#
# Quem serve tráfego é o `runner`. Quem aplica migrations / setup-app-role /
# seed é o `ops`, rodado como container one-shot pelo compose ou manualmente.
#
# Por que Debian slim e não Alpine:
#   Prisma + node-postgres compilados contra glibc casam com Debian sem
#   surpresa. Alpine usa musl e às vezes pede builds dedicados.
# =========================================================================

# =========================================================================
# 1) deps — instala todas as dependências (dev + prod)
# =========================================================================
FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# =========================================================================
# 2) builder — gera Prisma Client + faz next build (standalone)
# =========================================================================
FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL é exigido pelo `src/env.ts` durante o build (Next executa
# código de servidor para prerender). Valor dummy aqui não vaza pra runtime
# — runtime recebe o valor real pelo compose.
ENV DATABASE_URL="postgresql://build:build@build/build?sslmode=disable"
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# =========================================================================
# 3) runner — produção, mínimo, usuário não-root
# =========================================================================
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Output standalone já traz o server.js próprio + node_modules traced
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Assets estáticos não entram no standalone — copiamos manualmente
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Healthcheck — bate em /api/health (que faz SELECT 1 no Postgres)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]

# =========================================================================
# 4) ops — imagem irmã pra rodar bootstrap.sh (migrate + role + seed)
# =========================================================================
# Usa as deps completas (incl. tsx + prisma CLI) e roda como container
# one-shot. NÃO serve tráfego — só faz operações no banco e encerra.
FROM node:22-slim AS ops
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates bash \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/scripts         ./scripts
COPY --from=builder /app/src/generated   ./src/generated
COPY --from=builder /app/package.json    ./package.json

ENV NODE_ENV=production

CMD ["bash", "scripts/bootstrap.sh"]

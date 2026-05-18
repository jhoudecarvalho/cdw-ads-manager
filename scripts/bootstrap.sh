#!/usr/bin/env bash
# =========================================================================
# bootstrap.sh — primeira inicialização (e re-runs idempotentes) do app.
#
# Roda dentro do container (ou no host com DATABASE_URL/DIRECT_URL apontando
# pro Postgres alvo) e:
#   1. Aguarda o Postgres ficar pronto
#   2. Aplica migrations  (prisma migrate deploy)
#   3. Garante o role `franchise_hub_app` sem BYPASSRLS (setup-app-role)
#   4. Opcionalmente popula o seed  (--seed)
#
# É idempotente: rodar 2x não quebra nem duplica nada.
#
# Uso:
#   scripts/bootstrap.sh             # migrate + role
#   scripts/bootstrap.sh --seed      # + seed (dev / primeira subida)
# =========================================================================
set -euo pipefail

SEED=0
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "${DIRECT_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: defina DATABASE_URL (e idealmente DIRECT_URL) antes de rodar." >&2
  exit 1
fi

# -------------------------------------------------------------------------
# 1. Aguarda Postgres
# -------------------------------------------------------------------------
ADMIN_URL="${DIRECT_URL:-$DATABASE_URL}"

# Usa o Node pra fazer um SELECT 1 — não exigimos psql no container.
echo "→ Aguardando Postgres responder..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until ADMIN_URL="$ADMIN_URL" node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.ADMIN_URL });
  c.connect().then(() => c.query('SELECT 1')).then(() => c.end()).catch(e => { process.exit(1); });
" 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
    echo "ERRO: Postgres não respondeu após ${MAX_ATTEMPTS}s." >&2
    exit 1
  fi
  sleep 1
done
echo "  Postgres pronto (após ${ATTEMPTS}s)."

# -------------------------------------------------------------------------
# 2. Migrations
# -------------------------------------------------------------------------
echo "→ Aplicando migrations (prisma migrate deploy)..."
npx --no-install prisma migrate deploy

# -------------------------------------------------------------------------
# 3. App role (sem BYPASSRLS) — idempotente, só cria se não existir.
# -------------------------------------------------------------------------
echo "→ Garantindo role franchise_hub_app..."
npx --no-install tsx scripts/setup-app-role.ts

# -------------------------------------------------------------------------
# 4. Seed opcional
# -------------------------------------------------------------------------
if [[ $SEED -eq 1 ]]; then
  echo "→ Populando seed..."
  npx --no-install tsx prisma/seed.ts
fi

echo "✓ Bootstrap concluído."

-- SUPER_ADMIN: role acima dos tenants. Não pertence a tenant de cliente —
-- mora em um "tenant técnico" chamado `system`, que existe só para satisfazer
-- a FK `users.tenantId` (NOT NULL) e o `@@unique([tenantId, email])` atual.
--
-- O slug `__system__` é deliberadamente inválido pela regra do resolvedor
-- (TENANT_SLUG_REGEX exige começar com letra e proíbe underscore) — então
-- nenhum caminho `/__system__/...` é navegável. A área Super Admin vive em
-- `/admin/*` (route group próprio, sem `[slug]`).
--
-- Postgres exige que `ALTER TYPE ... ADD VALUE` seja committado antes de o
-- novo valor poder ser usado. Manter esta migration apenas adicionando o
-- enum e criando o tenant `system` — código que use `SUPER_ADMIN` (seed,
-- queries) só roda em migrations/runs posteriores.

ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN';

INSERT INTO "tenants" ("id", "slug", "name", "status", "tenantType", "createdAt", "updatedAt")
VALUES (
  'system',
  '__system__',
  'System',
  'ACTIVE',
  'FRANCHISE',
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

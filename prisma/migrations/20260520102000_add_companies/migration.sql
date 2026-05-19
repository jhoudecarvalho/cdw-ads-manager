-- Tabela `companies` — equivalente a `franchises` no modo COMPANY (lista
-- plana, sem Region). Mesma estratégia de RLS por `tenantId` que as demais
-- tabelas de negócio (espelha 20260518182000_enable_rls).
--
-- A função `app_apply_tenant_rls` daquele migration foi DROPada ao fim do
-- bloco — então o SQL de RLS aqui é inline.

CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "sector" TEXT,
    "cnpj" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "companies_tenantId_externalCode_key"
  ON "companies" ("tenantId", "externalCode");
CREATE INDEX "companies_tenantId_idx" ON "companies" ("tenantId");
CREATE INDEX "companies_tenantId_status_idx" ON "companies" ("tenantId", "status");

-- FK pra tenants
ALTER TABLE "companies"
  ADD CONSTRAINT "companies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: mesma policy `tenant_isolation` das outras tabelas de negócio.
-- FORCE garante que mesmo o dono respeita a policy (Prisma conecta como dono).
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "companies"
  FOR ALL
  USING ("tenantId"::text = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId"::text = current_setting('app.current_tenant_id', true));

-- Grants: condicional na role da app. Em prod (Neon) a role
-- `franchise_hub_app` existe com NOBYPASSRLS; em dev local o seed roda como
-- owner e dispensa grant. DO block evita erro se a role não existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'franchise_hub_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "companies" TO franchise_hub_app';
  END IF;
END $$;

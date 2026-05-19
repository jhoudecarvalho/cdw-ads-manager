-- Contadores monotônicos por tenant. Usado para gerar IDs visíveis sequenciais
-- (`EMP-0001`) de forma thread-safe via SELECT ... FOR UPDATE — sem depender
-- de retries em violação de UNIQUE.
--
-- Estrutura proposital genérica (campo `kind`) para reaproveitar caso surjam
-- outros recursos com numeração visível no futuro.

CREATE TABLE "tenant_counters" (
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_counters_pkey" PRIMARY KEY ("tenantId", "kind")
);

ALTER TABLE "tenant_counters"
  ADD CONSTRAINT "tenant_counters_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: igual às outras tabelas de negócio. Lock de FOR UPDATE acontece dentro
-- do `withTenantScope`, então a policy garante isolamento.
ALTER TABLE "tenant_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_counters" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "tenant_counters"
  FOR ALL
  USING ("tenantId"::text = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId"::text = current_setting('app.current_tenant_id', true));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'franchise_hub_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_counters" TO franchise_hub_app';
  END IF;
END $$;

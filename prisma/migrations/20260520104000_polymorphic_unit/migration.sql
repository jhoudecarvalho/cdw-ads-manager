-- Campaign / AdAccount viram polimórficas: cada uma pertence a UMA Franchise
-- OU a UMA Company (exatamente uma). CHECK XOR garante isso no banco.
--
-- Dados existentes são preservados: tornar `franchiseId` nullable não invalida
-- nenhuma linha (continuam preenchidos). O CHECK só rejeita rows futuras com
-- nenhuma ou ambas as referências.

-- ---------------------------------------------------------------------------
-- Campaign
-- ---------------------------------------------------------------------------

ALTER TABLE "campaigns" ALTER COLUMN "franchiseId" DROP NOT NULL;

ALTER TABLE "campaigns" ADD COLUMN "companyId" TEXT;

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_unit_xor"
  CHECK ((("franchiseId" IS NOT NULL)::int + ("companyId" IS NOT NULL)::int) = 1);

CREATE INDEX "campaigns_companyId_idx" ON "campaigns" ("companyId");
CREATE INDEX "campaigns_tenantId_companyId_idx" ON "campaigns" ("tenantId", "companyId");

-- ---------------------------------------------------------------------------
-- AdAccount
-- ---------------------------------------------------------------------------

ALTER TABLE "ad_accounts" ALTER COLUMN "franchiseId" DROP NOT NULL;

ALTER TABLE "ad_accounts" ADD COLUMN "companyId" TEXT;

ALTER TABLE "ad_accounts"
  ADD CONSTRAINT "ad_accounts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_accounts"
  ADD CONSTRAINT "ad_accounts_unit_xor"
  CHECK ((("franchiseId" IS NOT NULL)::int + ("companyId" IS NOT NULL)::int) = 1);

CREATE INDEX "ad_accounts_companyId_idx" ON "ad_accounts" ("companyId");

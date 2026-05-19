-- Modo operacional do tenant. FRANCHISE preserva o comportamento atual
-- (Region → Franchise). COMPANY ativa o modo Empresas (lista plana).
-- Default FRANCHISE garante que tenants existentes (anjos, kgepel, clickvel)
-- não mudam de comportamento na aplicação da migration — o seed depois muda
-- `kgepel` para COMPANY.

CREATE TYPE "TenantType" AS ENUM ('FRANCHISE', 'COMPANY');

ALTER TABLE "tenants"
  ADD COLUMN "tenantType" "TenantType" NOT NULL DEFAULT 'FRANCHISE';

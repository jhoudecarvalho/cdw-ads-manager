-- Novos eventos de auditoria usados pelas server actions de empresa/tenant/
-- impersonação. ALTER TYPE ADD VALUE em statements separados — Postgres
-- exige um por comando.

ALTER TYPE "AuditEventType" ADD VALUE 'COMPANY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'COMPANY_STATUS_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_IMPERSONATED';
ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_IMPERSONATION_ENDED';

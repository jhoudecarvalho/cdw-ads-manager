-- Row-Level Security para o multi-tenancy do Franchise HUB.
--
-- Toda tabela com `tenant_id` recebe RLS + uma policy `tenant_isolation`
-- que compara `tenant_id` com `app.current_tenant_id` (definido pelo helper
-- `withTenantScope` no início de cada transação).
--
-- `FORCE ROW LEVEL SECURITY` garante que mesmo o dono da tabela respeita a
-- policy — Prisma se conecta como dono. Sem `FORCE`, o RLS seria
-- silenciosamente ignorado.
--
-- `current_setting('app.current_tenant_id', true)` — o segundo argumento
-- `true` faz a função retornar NULL quando a variável não está definida (em
-- vez de erro). NULL vs `tenant_id` é unknown, então a policy nega tudo.
-- Esse é o default seguro: query sem scope = zero resultados.
--
-- A tabela `tenants` NÃO tem RLS (é a fonte da verdade do tenant, lida
-- pelo resolver antes de qualquer scope existir).

CREATE OR REPLACE FUNCTION app_apply_tenant_rls(p_table text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format(
    -- Coluna é `"tenantId"` (camelCase, quoted) por convenção do Prisma.
    'CREATE POLICY tenant_isolation ON %I FOR ALL '
    || 'USING ("tenantId"::text = current_setting(''app.current_tenant_id'', true)) '
    || 'WITH CHECK ("tenantId"::text = current_setting(''app.current_tenant_id'', true))',
    p_table
  );
END;
$$ LANGUAGE plpgsql;

SELECT app_apply_tenant_rls('users');
SELECT app_apply_tenant_rls('terms_acceptances');
SELECT app_apply_tenant_rls('audit_logs');
SELECT app_apply_tenant_rls('regions');
SELECT app_apply_tenant_rls('franchises');
SELECT app_apply_tenant_rls('user_franchises');
SELECT app_apply_tenant_rls('user_regions');
SELECT app_apply_tenant_rls('ad_accounts');
SELECT app_apply_tenant_rls('campaigns');
SELECT app_apply_tenant_rls('campaign_metrics_daily');
SELECT app_apply_tenant_rls('sync_logs');

DROP FUNCTION app_apply_tenant_rls(text);

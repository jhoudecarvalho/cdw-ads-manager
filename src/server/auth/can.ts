import type { TenantType, UserRole } from "@/generated/prisma/client";

/**
 * Sistema de autorização — sempre checado **no servidor**, nunca apenas
 * escondendo botões na UI.
 *
 * Função pura, sem dependência de banco. Quem chama é responsável por
 * carregar o `ActorContext` com `franchiseIds` / `regionIds` do usuário
 * (vínculos vêm das tabelas UserFranchise/UserRegion que serão criadas na
 * Fase 3). Enquanto esses arrays não existem, ações de REGIONAL/FRANCHISEE
 * que dependem deles retornam `false` — o que é o default seguro.
 *
 * SUPER_ADMIN é a exceção: ignora a "regra zero" de tenant — pode atuar
 * cross-tenant (criar tenant, listar tudo, impersonar). Continua passando
 * por `withTenantScope` para tocar dados de negócio; RLS é defesa final.
 */

export type Action =
  | "manage_users" // CRUD de usuários do tenant
  | "view_dashboards" // KPIs, gráficos, visão geral
  | "view_franchise" // ver detalhes de uma franquia específica
  | "manage_franchise" // editar, suspender, criar franquia
  | "view_company" // ver detalhes de uma empresa específica
  | "manage_companies" // criar/editar/desativar empresas (modo COMPANY)
  | "manage_ad_accounts" // conectar/desconectar OAuth Google/Meta
  | "manage_regions" // CRUD de regiões
  | "view_audit_log" // trilha LGPD
  // Super admin
  | "view_all_tenants" // listar/inspecionar tenants
  | "manage_tenants" // criar/editar tenants
  | "impersonate_tenant"; // "entrar como" um tenant para suporte

export type ActorContext = {
  id: string;
  tenantId: string;
  role: UserRole;
  /** Tipo do tenant a que o ator pertence — vem do JWT. */
  tenantType: TenantType;
  /** IDs de franquias às quais o usuário está vinculado (Fase 3). */
  franchiseIds?: string[];
  /** IDs de regiões às quais o usuário está vinculado (Fase 3). */
  regionIds?: string[];
};

export type ResourceContext = {
  tenantId: string;
  franchiseId?: string;
  regionId?: string;
  companyId?: string;
};

/**
 * Decide se `actor` pode realizar `action` sobre `resource`.
 *
 * Regra zero (não-negociável para ADMIN/REGIONAL/FRANCHISEE): se
 * `resource.tenantId` não bate com o tenant do ator, retorna false. Isso é
 * a primeira linha de defesa — RLS no banco é a segunda.
 *
 * SUPER_ADMIN pula a regra zero — é o único caminho autorizado a atravessar
 * tenants. Continua sendo obrigatório que esses caminhos passem por
 * `withTenantScope(targetTenantId)` para tocar dados (RLS continua filtrando).
 */
export function can(
  actor: ActorContext,
  action: Action,
  resource?: ResourceContext,
): boolean {
  if (actor.role === "SUPER_ADMIN") return true;

  if (resource && resource.tenantId !== actor.tenantId) return false;

  switch (actor.role) {
    case "ADMIN":
      return canAdmin(action);

    case "REGIONAL":
      return canRegional(actor, action, resource);

    case "FRANCHISEE":
      return canFranchisee(actor, action, resource);

    default:
      return false;
  }
}

function canAdmin(action: Action): boolean {
  switch (action) {
    // ADMIN do tenant é "dono" do tenant — tudo dentro dele.
    case "manage_users":
    case "view_dashboards":
    case "view_franchise":
    case "manage_franchise":
    case "view_company":
    case "manage_companies":
    case "manage_ad_accounts":
    case "manage_regions":
    case "view_audit_log":
      return true;
    // Ações cross-tenant são exclusivas de SUPER_ADMIN.
    case "view_all_tenants":
    case "manage_tenants":
    case "impersonate_tenant":
      return false;
  }
}

function canRegional(
  actor: ActorContext,
  action: Action,
  resource?: ResourceContext,
): boolean {
  const regionIds = actor.regionIds ?? [];

  switch (action) {
    case "view_dashboards":
      return true;
    case "view_franchise":
    case "manage_franchise":
      if (!resource?.regionId) return false;
      return regionIds.includes(resource.regionId);
    // REGIONAL é um papel exclusivo do modo FRANCHISE — Company/regions
    // não se aplicam aqui.
    case "view_company":
    case "manage_companies":
    case "manage_ad_accounts":
    case "manage_users":
    case "manage_regions":
    case "view_audit_log":
    case "view_all_tenants":
    case "manage_tenants":
    case "impersonate_tenant":
      return false;
  }
}

function canFranchisee(
  actor: ActorContext,
  action: Action,
  resource?: ResourceContext,
): boolean {
  const franchiseIds = actor.franchiseIds ?? [];

  switch (action) {
    case "view_dashboards":
      return true;
    case "view_franchise":
    case "manage_ad_accounts":
      if (!resource?.franchiseId) return false;
      return franchiseIds.includes(resource.franchiseId);
    case "manage_franchise":
    case "view_company":
    case "manage_companies":
    case "manage_users":
    case "manage_regions":
    case "view_audit_log":
    case "view_all_tenants":
    case "manage_tenants":
    case "impersonate_tenant":
      return false;
  }
}

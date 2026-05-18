import type { UserRole } from "@/generated/prisma/client";

/**
 * Sistema de autorização — sempre checado **no servidor**, nunca apenas
 * escondendo botões na UI.
 *
 * Função pura, sem dependência de banco. Quem chama é responsável por
 * carregar o `ActorContext` com `franchiseIds` / `regionIds` do usuário
 * (vínculos vêm das tabelas UserFranchise/UserRegion que serão criadas na
 * Fase 3). Enquanto esses arrays não existem, ações de REGIONAL/FRANCHISEE
 * que dependem deles retornam `false` — o que é o default seguro.
 */

export type Action =
  | "manage_users" // CRUD de usuários do tenant
  | "view_dashboards" // KPIs, gráficos, visão geral
  | "view_franchise" // ver detalhes de uma franquia específica
  | "manage_franchise" // editar, suspender, criar franquia
  | "manage_ad_accounts" // conectar/desconectar OAuth Google/Meta
  | "manage_regions" // CRUD de regiões
  | "view_audit_log"; // trilha LGPD

export type ActorContext = {
  id: string;
  tenantId: string;
  role: UserRole;
  /** IDs de franquias às quais o usuário está vinculado (Fase 3). */
  franchiseIds?: string[];
  /** IDs de regiões às quais o usuário está vinculado (Fase 3). */
  regionIds?: string[];
};

export type ResourceContext = {
  tenantId: string;
  franchiseId?: string;
  regionId?: string;
};

/**
 * Decide se `actor` pode realizar `action` sobre `resource`.
 *
 * Regra zero (não-negociável): se `resource.tenantId` não bate com o tenant
 * do ator, retorna false. Isso é a primeira linha de defesa — RLS no banco
 * é a segunda.
 */
export function can(
  actor: ActorContext,
  action: Action,
  resource?: ResourceContext,
): boolean {
  if (resource && resource.tenantId !== actor.tenantId) return false;

  switch (actor.role) {
    case "ADMIN":
      return true;

    case "REGIONAL":
      return canRegional(actor, action, resource);

    case "FRANCHISEE":
      return canFranchisee(actor, action, resource);

    default:
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
    case "manage_ad_accounts":
    case "manage_users":
    case "manage_regions":
    case "view_audit_log":
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
    case "manage_users":
    case "manage_regions":
    case "view_audit_log":
      return false;
  }
}

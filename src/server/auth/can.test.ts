import { describe, expect, it } from "vitest";
import { can, type ActorContext } from "./can";

const TENANT_A = "tenant_a";
const TENANT_B = "tenant_b";

const admin: ActorContext = {
  id: "u1",
  tenantId: TENANT_A,
  role: "ADMIN",
  tenantType: "FRANCHISE",
};

const adminCompany: ActorContext = {
  id: "u1c",
  tenantId: TENANT_A,
  role: "ADMIN",
  tenantType: "COMPANY",
};

const regional: ActorContext = {
  id: "u2",
  tenantId: TENANT_A,
  role: "REGIONAL",
  tenantType: "FRANCHISE",
  regionIds: ["region_1"],
};

const franchisee: ActorContext = {
  id: "u3",
  tenantId: TENANT_A,
  role: "FRANCHISEE",
  tenantType: "FRANCHISE",
  franchiseIds: ["franchise_1"],
};

const superAdmin: ActorContext = {
  id: "uSA",
  tenantId: "system",
  role: "SUPER_ADMIN",
  tenantType: "FRANCHISE",
};

describe("can() — boundary de tenant", () => {
  it("nega QUALQUER ação sobre recurso de outro tenant, mesmo para ADMIN", () => {
    expect(can(admin, "view_dashboards", { tenantId: TENANT_B })).toBe(false);
    expect(can(admin, "manage_users", { tenantId: TENANT_B })).toBe(false);
  });

  it("ADMIN sem resource: permite ações tenant-globais", () => {
    expect(can(admin, "manage_users")).toBe(true);
    expect(can(admin, "view_audit_log")).toBe(true);
  });
});

describe("can() — ADMIN", () => {
  it.each([
    "manage_users",
    "view_dashboards",
    "view_franchise",
    "manage_franchise",
    "manage_ad_accounts",
    "manage_regions",
    "view_audit_log",
    "view_company",
    "manage_companies",
  ] as const)("permite %s no próprio tenant", (action) => {
    expect(can(admin, action, { tenantId: TENANT_A })).toBe(true);
  });

  it.each([
    "view_all_tenants",
    "manage_tenants",
    "impersonate_tenant",
  ] as const)("nega ações cross-tenant (%s)", (action) => {
    expect(can(admin, action)).toBe(false);
    expect(can(adminCompany, action)).toBe(false);
  });
});

describe("can() — REGIONAL", () => {
  it("vê dashboards", () => {
    expect(can(regional, "view_dashboards", { tenantId: TENANT_A })).toBe(true);
  });

  it("vê franquia de região vinculada", () => {
    expect(
      can(regional, "view_franchise", {
        tenantId: TENANT_A,
        regionId: "region_1",
      }),
    ).toBe(true);
  });

  it("não vê franquia de região não vinculada", () => {
    expect(
      can(regional, "view_franchise", {
        tenantId: TENANT_A,
        regionId: "region_999",
      }),
    ).toBe(false);
  });

  it("não vê franquia quando o resource não traz regionId", () => {
    expect(can(regional, "view_franchise", { tenantId: TENANT_A })).toBe(false);
  });

  it("não pode gerenciar usuários, regiões ou contas de anúncio", () => {
    expect(can(regional, "manage_users", { tenantId: TENANT_A })).toBe(false);
    expect(can(regional, "manage_regions", { tenantId: TENANT_A })).toBe(false);
    expect(can(regional, "manage_ad_accounts", { tenantId: TENANT_A })).toBe(
      false,
    );
  });
});

describe("can() — FRANCHISEE", () => {
  it("vê dashboards (com filtros aplicados depois)", () => {
    expect(can(franchisee, "view_dashboards", { tenantId: TENANT_A })).toBe(
      true,
    );
  });

  it("conecta conta de anúncio da própria franquia", () => {
    expect(
      can(franchisee, "manage_ad_accounts", {
        tenantId: TENANT_A,
        franchiseId: "franchise_1",
      }),
    ).toBe(true);
  });

  it("NÃO conecta conta de anúncio de outra franquia", () => {
    expect(
      can(franchisee, "manage_ad_accounts", {
        tenantId: TENANT_A,
        franchiseId: "franchise_999",
      }),
    ).toBe(false);
  });

  it("não administra franquia nem usuários", () => {
    expect(
      can(franchisee, "manage_franchise", {
        tenantId: TENANT_A,
        franchiseId: "franchise_1",
      }),
    ).toBe(false);
    expect(can(franchisee, "manage_users", { tenantId: TENANT_A })).toBe(false);
  });
});

describe("can() — sem vínculos carregados (defaults seguros)", () => {
  const regionalSemVinculo: ActorContext = {
    id: "u4",
    tenantId: TENANT_A,
    role: "REGIONAL",
    tenantType: "FRANCHISE",
  };

  it("REGIONAL sem regionIds → não pode ver franquias", () => {
    expect(
      can(regionalSemVinculo, "view_franchise", {
        tenantId: TENANT_A,
        regionId: "region_1",
      }),
    ).toBe(false);
  });
});

describe("can() — SUPER_ADMIN", () => {
  it("ignora a regra zero: atravessa tenants em qualquer ação", () => {
    expect(can(superAdmin, "view_dashboards", { tenantId: TENANT_A })).toBe(
      true,
    );
    expect(can(superAdmin, "view_dashboards", { tenantId: TENANT_B })).toBe(
      true,
    );
    expect(can(superAdmin, "manage_users", { tenantId: TENANT_B })).toBe(true);
  });

  it.each([
    "view_all_tenants",
    "manage_tenants",
    "impersonate_tenant",
    "manage_companies",
    "manage_franchise",
    "view_audit_log",
  ] as const)("permite ação cross-tenant (%s) sem resource", (action) => {
    expect(can(superAdmin, action)).toBe(true);
  });

  it("REGIONAL e FRANCHISEE não recebem privilégios cross-tenant", () => {
    expect(can(regional, "view_all_tenants")).toBe(false);
    expect(can(franchisee, "impersonate_tenant")).toBe(false);
  });
});

describe("can() — modo COMPANY", () => {
  it("ADMIN COMPANY cria e visualiza empresas", () => {
    expect(can(adminCompany, "manage_companies", { tenantId: TENANT_A })).toBe(
      true,
    );
    expect(
      can(adminCompany, "view_company", {
        tenantId: TENANT_A,
        companyId: "comp_1",
      }),
    ).toBe(true);
  });

  it("ADMIN não consegue gerenciar empresas em outro tenant", () => {
    expect(can(adminCompany, "manage_companies", { tenantId: TENANT_B })).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";
import { getTenantModule, TENANT_MODULES } from "./tenant-modules";

describe("getTenantModule", () => {
  it("FRANCHISE: rotula 'Franquia(s)', tem regiões e não cadastra unidades pela UI", () => {
    const m = getTenantModule("FRANCHISE");
    expect(m.unitLabel).toBe("Franquia");
    expect(m.unitLabelPlural).toBe("Franquias");
    expect(m.hasRegions).toBe(true);
    expect(m.canRegisterUnits).toBe(false);
    expect(m.groupBy).toBe("region");
  });

  it("COMPANY: rotula 'Empresa(s)', sem regiões, cadastra pela UI, agrupa por setor", () => {
    const m = getTenantModule("COMPANY");
    expect(m.unitLabel).toBe("Empresa");
    expect(m.unitLabelPlural).toBe("Empresas");
    expect(m.hasRegions).toBe(false);
    expect(m.canRegisterUnits).toBe(true);
    expect(m.groupBy).toBe("sector");
  });

  it("TENANT_MODULES expõe os dois tipos e nada mais", () => {
    expect(Object.keys(TENANT_MODULES).sort()).toEqual(["COMPANY", "FRANCHISE"]);
  });
});

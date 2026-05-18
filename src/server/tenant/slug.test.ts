import { describe, expect, it } from "vitest";
import { isValidTenantSlug, TENANT_SLUG_REGEX } from "./slug";

describe("isValidTenantSlug", () => {
  it.each([
    ["anjos", true],
    ["kgepel", true],
    ["a1", true],
    ["franquia-do-sul", true],
    ["x".repeat(63), true],
  ])("aceita slug válido %s", (slug, expected) => {
    expect(isValidTenantSlug(slug)).toBe(expected);
  });

  it.each([
    ["", false],
    ["A", false], // maiúscula
    ["1a", false], // não começa com letra
    ["a", false], // curto demais (regex exige 2+)
    ["x".repeat(64), false], // longo demais
    ["foo_bar", false], // underscore
    ["foo bar", false], // espaço
    ["api", false], // reservado
    ["_next", false], // reservado
    ["admin", false], // reservado
  ])("rejeita slug inválido %s", (slug, expected) => {
    expect(isValidTenantSlug(slug)).toBe(expected);
  });

  it("regex exportada bate com a função", () => {
    expect(TENANT_SLUG_REGEX.test("anjos")).toBe(true);
  });
});

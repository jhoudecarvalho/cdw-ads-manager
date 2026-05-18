import { describe, expect, it } from "vitest";
import { decrypt, decryptOptional, encrypt } from "./tokens";

describe("crypto/tokens", () => {
  it("encrypt → decrypt: round-trip preserva o valor", () => {
    const plain = "ya29.a0AfH6SMC_super-long-google-access-token-xyz";
    const ct = encrypt(plain);
    expect(ct).not.toContain(plain);
    expect(ct.startsWith("v1:")).toBe(true);
    expect(decrypt(ct)).toBe(plain);
  });

  it("encrypt: chamadas distintas produzem ciphertexts diferentes (IV aleatório)", () => {
    const a = encrypt("mesmo-token");
    const b = encrypt("mesmo-token");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("decrypt: rejeita ciphertext adulterado (auth tag bate)", () => {
    const ct = encrypt("segredo");
    // Flipa um caractere do ciphertext, mantendo o formato.
    const parts = ct.split(":");
    const tampered = parts[3]!
      .split("")
      .map((c, i) => (i === 0 ? (c === "A" ? "B" : "A") : c))
      .join("");
    parts[3] = tampered;
    const corrupted = parts.join(":");
    expect(() => decrypt(corrupted)).toThrow();
  });

  it("decrypt: rejeita versão desconhecida", () => {
    expect(() => decrypt("v999:foo:bar:baz")).toThrow(
      /versão desconhecida|formato/,
    );
  });

  it("decryptOptional: null/undefined → null", () => {
    expect(decryptOptional(null)).toBeNull();
    expect(decryptOptional(undefined)).toBeNull();
  });
});

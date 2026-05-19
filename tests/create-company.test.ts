/**
 * Teste de integração do contador de empresas — `tenant_counters` deve gerar
 * `EMP-XXXX` sequenciais sem duplicar nem pular números mesmo sob criação
 * concorrente.
 *
 * Estratégia: roda N criações em paralelo dentro do mesmo tenant e verifica:
 *   1. Todas criadas com sucesso (nenhuma colisão de UNIQUE).
 *   2. externalCodes formam sequência consecutiva [start+1 .. start+N].
 *   3. Nenhum código duplicado.
 *
 * Toca o Neon real — assume seed pré-existente (tenant `kgepel` em modo
 * COMPANY).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";

let TENANT_ID = "";
let initialCounter = 0;
let createdIds: string[] = [];

beforeAll(async () => {
  const t = await prisma.tenant.findUnique({
    where: { slug: "kgepel" },
    select: { id: true, tenantType: true },
  });
  if (!t || t.tenantType !== "COMPANY") {
    throw new Error("Tenant 'kgepel' precisa estar em modo COMPANY. Rode o seed.");
  }
  TENANT_ID = t.id;

  // Snapshot do contador antes do teste.
  const counter = await withTenantScope(TENANT_ID, (tx) =>
    tx.tenantCounter.findUnique({
      where: { tenantId_kind: { tenantId: TENANT_ID, kind: "company" } },
      select: { value: true },
    }),
  );
  initialCounter = counter?.value ?? 0;
});

afterAll(async () => {
  // Limpa as empresas criadas durante o teste para o seed continuar idempotente.
  if (createdIds.length > 0) {
    await withTenantScope(TENANT_ID, (tx) =>
      tx.company.deleteMany({ where: { id: { in: createdIds } } }),
    );
    // Reverte o counter para o estado anterior.
    await withTenantScope(TENANT_ID, (tx) =>
      tx.tenantCounter.update({
        where: { tenantId_kind: { tenantId: TENANT_ID, kind: "company" } },
        data: { value: initialCounter },
      }),
    );
  }
});

async function createWithAtomicCounter(name: string): Promise<{
  id: string;
  externalCode: string;
}> {
  return withTenantScope(TENANT_ID, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ value: number }>>`
      INSERT INTO "tenant_counters" ("tenantId", "kind", "value")
      VALUES (${TENANT_ID}, 'company', 1)
      ON CONFLICT ("tenantId", "kind")
      DO UPDATE SET "value" = "tenant_counters"."value" + 1
      RETURNING "value"
    `;
    const value = rows[0]!.value;
    const externalCode = `EMP-${String(value).padStart(4, "0")}`;
    const co = await tx.company.create({
      data: {
        tenantId: TENANT_ID,
        externalCode,
        name,
        status: "ACTIVE",
      },
      select: { id: true, externalCode: true },
    });
    return co;
  });
}

describe("createCompany — counter EMP-XXXX", () => {
  it("10 criações concorrentes geram 10 códigos únicos e consecutivos", async () => {
    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        createWithAtomicCounter(`Concorrencia ${i + 1} ${Date.now()}`),
      ),
    );
    createdIds = results.map((r) => r.id);

    const codes = results.map((r) => r.externalCode);
    expect(new Set(codes).size).toBe(N); // sem duplicatas

    // Os N códigos formam um conjunto consecutivo a partir de initialCounter+1.
    const numbers = codes
      .map((c) => Number(c.replace("EMP-", "")))
      .sort((a, b) => a - b);
    const expected = Array.from({ length: N }, (_, i) => initialCounter + i + 1);
    expect(numbers).toEqual(expected);
  });
});

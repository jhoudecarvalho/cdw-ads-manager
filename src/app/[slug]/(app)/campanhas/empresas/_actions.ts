"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { can } from "@/server/auth/can";
import { loadActorContext } from "@/server/auth/load-actor";
import { recordAudit } from "@/server/audit/record";
import { withTenantScope } from "@/server/db/tenant-scope";

/**
 * Server Actions do módulo Empresas (modo COMPANY).
 *
 * Autorização sempre no servidor — `can(actor, "manage_companies", ...)`.
 * Em tenant FRANCHISE essa rota nem aparece na sidebar, mas a action é a
 * última linha de defesa: rejeita se `actor.tenantType !== "COMPANY"`.
 * SUPER_ADMIN passa por `can()` (libera tudo) e fica auditado.
 */

export type CompanyFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Slug do tenant — útil pra UI redirecionar após sucesso. */
  redirectTo?: string;
};

const CnpjOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || /^[\d./-]{14,18}$/.test(v), {
    message: "CNPJ inválido — informe 14 dígitos (com ou sem máscara).",
  });

const CreateCompanySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da empresa").max(200),
  sector: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  cnpj: CnpjOptional,
  contactEmail: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, {
      message: "E-mail inválido.",
    }),
});

function toFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_form";
    out[k] ??= issue.message;
  }
  return out;
}

/**
 * Incrementa atomicamente o contador `company` do tenant e retorna o novo
 * valor. Usa `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` para evitar a
 * janela de corrida do read-modify-write do Prisma.upsert.
 *
 * RLS continua filtrando — a transação está dentro de `withTenantScope`.
 */
async function nextCompanyExternalCode(
  tx: Parameters<Parameters<typeof withTenantScope>[1]>[0],
  tenantId: string,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "tenant_counters" ("tenantId", "kind", "value")
    VALUES (${tenantId}, 'company', 1)
    ON CONFLICT ("tenantId", "kind")
    DO UPDATE SET "value" = "tenant_counters"."value" + 1
    RETURNING "value"
  `;
  const next = rows[0]?.value;
  if (!next || typeof next !== "number") {
    throw new Error("Falha ao gerar externalCode da empresa.");
  }
  return `EMP-${String(next).padStart(4, "0")}`;
}

export async function createCompanyAction(
  slug: string,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const actor = await loadActorContext(session);

  if (actor.tenantType !== "COMPANY") {
    return { ok: false, error: "Tenant atual não suporta empresas." };
  }
  if (!can(actor, "manage_companies", { tenantId: actor.tenantId })) {
    return { ok: false, error: "Sem permissão para cadastrar empresas." };
  }

  const parsed = CreateCompanySchema.safeParse({
    name: formData.get("name"),
    sector: formData.get("sector"),
    cnpj: formData.get("cnpj"),
    contactEmail: formData.get("contactEmail"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  let createdId: string;
  let externalCode: string;
  try {
    const result = await withTenantScope(actor.tenantId, async (tx) => {
      const code = await nextCompanyExternalCode(tx, actor.tenantId);
      const created = await tx.company.create({
        data: {
          tenantId: actor.tenantId,
          externalCode: code,
          name: parsed.data.name,
          sector: parsed.data.sector ?? null,
          cnpj: parsed.data.cnpj ?? null,
          contactEmail: parsed.data.contactEmail ?? null,
        },
        select: { id: true, externalCode: true },
      });
      return created;
    });
    createdId = result.id;
    externalCode = result.externalCode;
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Erro inesperado ao criar empresa.",
    };
  }

  await recordAudit({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    eventType: "COMPANY_CREATED",
    resourceType: "company",
    resourceId: createdId,
    metadata: { externalCode, name: parsed.data.name },
  });

  revalidatePath(`/${slug}/campanhas/empresas`);
  return { ok: true, redirectTo: `/${slug}/campanhas/empresas` };
}

const SetStatusSchema = z.object({
  companyId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export async function setCompanyStatusAction(
  slug: string,
  input: { companyId: string; status: "ACTIVE" | "INACTIVE" },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const actor = await loadActorContext(session);

  if (actor.tenantType !== "COMPANY") {
    return { ok: false, error: "Tenant atual não suporta empresas." };
  }
  if (!can(actor, "manage_companies", { tenantId: actor.tenantId })) {
    return { ok: false, error: "Sem permissão." };
  }

  const parsed = SetStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida." };

  try {
    await withTenantScope(actor.tenantId, async (tx) => {
      await tx.company.update({
        where: { id: parsed.data.companyId },
        data: { status: parsed.data.status },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Erro inesperado ao atualizar.",
    };
  }

  await recordAudit({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    eventType: "COMPANY_STATUS_CHANGED",
    resourceType: "company",
    resourceId: parsed.data.companyId,
    metadata: { status: parsed.data.status },
  });

  revalidatePath(`/${slug}/campanhas/empresas`);
  return { ok: true };
}

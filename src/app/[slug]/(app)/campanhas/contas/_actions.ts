"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { can } from "@/server/auth/can";
import { loadActorContext } from "@/server/auth/load-actor";
import { recordAudit } from "@/server/audit/record";
import { withTenantScope } from "@/server/db/tenant-scope";

/**
 * Server Actions de Contas de Anúncio (modo mock — sem OAuth ainda).
 *
 * Criar uma conta aqui registra o vínculo (franquia OU empresa) e o
 * `externalAccountId`, mas sem tokens — `accessToken`/`refreshToken` ficam
 * null até o fluxo OAuth real (etapa futura). O sync em modo mock ignora
 * credenciais, então a conta já passa a receber campanhas/métricas mockadas
 * no próximo "Atualizar agora".
 *
 * Autorização: `can(actor, "manage_ad_accounts", { tenantId, franchiseId? })`.
 * ADMIN/SUPER_ADMIN: qualquer unidade. FRANCHISEE: só as próprias franquias.
 */

export type AdAccountFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const CreateSchema = z.object({
  platform: z.enum(["GOOGLE_ADS", "META_ADS"]),
  externalAccountId: z
    .string()
    .trim()
    .min(1, "Informe o ID da conta")
    .max(120),
  unitId: z.string().trim().min(1, "Selecione a unidade"),
});

function toFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_form";
    out[k] ??= issue.message;
  }
  return out;
}

export async function createAdAccountAction(
  slug: string,
  _prev: AdAccountFormState,
  formData: FormData,
): Promise<AdAccountFormState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const actor = await loadActorContext(session);

  const parsed = CreateSchema.safeParse({
    platform: formData.get("platform"),
    externalAccountId: formData.get("externalAccountId"),
    unitId: formData.get("unitId"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }
  const { platform, externalAccountId, unitId } = parsed.data;
  const isCompany = actor.tenantType === "COMPANY";

  // Autorização: para FRANCHISEE precisamos passar franchiseId no resource.
  const authorized = isCompany
    ? can(actor, "manage_ad_accounts", { tenantId: actor.tenantId })
    : can(actor, "manage_ad_accounts", {
        tenantId: actor.tenantId,
        franchiseId: unitId,
      });
  if (!authorized) {
    return { ok: false, error: "Sem permissão para conectar contas." };
  }

  try {
    await withTenantScope(actor.tenantId, async (tx) => {
      // Valida que a unidade existe no tenant antes de vincular (RLS já
      // restringe ao tenant, mas confirmamos a existência para erro amigável).
      if (isCompany) {
        const c = await tx.company.findFirst({
          where: { id: unitId, deletedAt: null },
          select: { id: true },
        });
        if (!c) throw new Error("Empresa não encontrada.");
      } else {
        const f = await tx.franchise.findFirst({
          where: { id: unitId, deletedAt: null },
          select: { id: true },
        });
        if (!f) throw new Error("Franquia não encontrada.");
      }

      await tx.adAccount.create({
        data: {
          tenantId: actor.tenantId,
          ...(isCompany ? { companyId: unitId } : { franchiseId: unitId }),
          platform,
          externalAccountId,
          status: "CONNECTED",
          // Sem OAuth ainda — tokens entram na etapa de conexão real.
          accessToken: null,
          refreshToken: null,
        },
      });
    });
  } catch (err) {
    // Conflito de unique (tenantId, platform, externalAccountId) → mensagem amigável.
    const msg = err instanceof Error ? err.message : "Erro inesperado.";
    if (msg.includes("Unique constraint") || msg.includes("ad_accounts_tenantId_platform")) {
      return {
        ok: false,
        fieldErrors: {
          externalAccountId: "Já existe uma conta com esse ID nessa plataforma.",
        },
      };
    }
    return { ok: false, error: msg };
  }

  await recordAudit({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    eventType: "AD_ACCOUNT_CONNECTED",
    resourceType: "ad_account",
    metadata: { platform, externalAccountId, unitId, mock: true },
  });

  revalidatePath(`/${slug}/campanhas/contas`);
  return { ok: true };
}

export async function disconnectAdAccountAction(
  slug: string,
  input: { adAccountId: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const actor = await loadActorContext(session);

  const adAccountId = z.string().min(1).safeParse(input.adAccountId);
  if (!adAccountId.success) return { ok: false, error: "Entrada inválida." };

  try {
    await withTenantScope(actor.tenantId, async (tx) => {
      const acc = await tx.adAccount.findFirst({
        where: { id: input.adAccountId, deletedAt: null },
        select: { franchiseId: true },
      });
      if (!acc) throw new Error("Conta não encontrada.");

      // Autorização fina para FRANCHISEE — precisa ser dono da franquia.
      const authorized =
        actor.tenantType === "COMPANY"
          ? can(actor, "manage_ad_accounts", { tenantId: actor.tenantId })
          : can(actor, "manage_ad_accounts", {
              tenantId: actor.tenantId,
              franchiseId: acc.franchiseId ?? undefined,
            });
      if (!authorized) throw new Error("Sem permissão.");

      // Soft delete: some da lista e do sync (filtra deletedAt null + CONNECTED),
      // mas campanhas/métricas históricas ficam.
      await tx.adAccount.update({
        where: { id: input.adAccountId },
        data: { deletedAt: new Date(), status: "REVOKED" },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro inesperado.",
    };
  }

  await recordAudit({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    eventType: "AD_ACCOUNT_DISCONNECTED",
    resourceType: "ad_account",
    resourceId: input.adAccountId,
  });

  revalidatePath(`/${slug}/campanhas/contas`);
  return { ok: true };
}

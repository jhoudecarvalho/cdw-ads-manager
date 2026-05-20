"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/server/auth/can";
import { resolveActorForSlug } from "@/server/auth/require-actor";
import { recordAudit } from "@/server/audit/record";
import { withTenantScope } from "@/server/db/tenant-scope";
import { encrypt } from "@/server/crypto/tokens";
import { clearMetaPending, readMetaPending } from "@/server/ads/meta-pending";

export type ConfirmState = {
  ok: boolean;
  error?: string;
  redirectTo?: string;
};

const Schema = z.object({ externalAccountId: z.string().min(1) });

/**
 * Confirma a conta Meta escolhida na tela de seleção: lê o cookie pending
 * (token long-lived + contas), cria a AdAccount com o token **cifrado**,
 * audita e limpa o cookie.
 *
 * Reconexão: se já existe uma AdAccount (tenantId, META_ADS, externalAccountId)
 * — inclusive removida — atualiza o token e reativa, em vez de violar o
 * unique. Isso cobre o caso de reconectar uma conta antes desconectada.
 */
export async function confirmMetaAccountAction(
  slug: string,
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const resolved = await resolveActorForSlug(slug);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const actor = resolved.actor;

  const parsed = Schema.safeParse({
    externalAccountId: formData.get("externalAccountId"),
  });
  if (!parsed.success) return { ok: false, error: "Conta inválida." };

  const pending = await readMetaPending();
  if (!pending) {
    return {
      ok: false,
      error: "Sessão de conexão expirou. Conecte novamente via Meta.",
    };
  }
  if (pending.slug !== slug) {
    return { ok: false, error: "Conexão pertence a outro tenant." };
  }

  const chosen = pending.accounts.find(
    (a) => a.externalAccountId === parsed.data.externalAccountId,
  );
  if (!chosen) {
    return { ok: false, error: "Conta não está entre as autorizadas." };
  }

  const isCompany = actor.tenantType === "COMPANY";
  const authorized = isCompany
    ? can(actor, "manage_ad_accounts", { tenantId: actor.tenantId })
    : can(actor, "manage_ad_accounts", {
        tenantId: actor.tenantId,
        franchiseId: pending.unitId,
      });
  if (!authorized) return { ok: false, error: "Sem permissão." };

  const encToken = encrypt(pending.token);
  const expiresAt = new Date(pending.expiresAt);

  try {
    await withTenantScope(actor.tenantId, async (tx) => {
      // Valida a unidade no tenant.
      if (isCompany) {
        const c = await tx.company.findFirst({
          where: { id: pending.unitId, deletedAt: null },
          select: { id: true },
        });
        if (!c) throw new Error("Empresa não encontrada.");
      } else {
        const f = await tx.franchise.findFirst({
          where: { id: pending.unitId, deletedAt: null },
          select: { id: true },
        });
        if (!f) throw new Error("Franquia não encontrada.");
      }

      const existing = await tx.adAccount.findFirst({
        where: {
          platform: "META_ADS",
          externalAccountId: chosen.externalAccountId,
        },
        select: { id: true },
      });

      if (existing) {
        // Reconecta/atualiza token — também reassocia à unidade escolhida.
        await tx.adAccount.update({
          where: { id: existing.id },
          data: {
            ...(isCompany
              ? { companyId: pending.unitId, franchiseId: null }
              : { franchiseId: pending.unitId, companyId: null }),
            accessToken: encToken,
            tokenExpiresAt: expiresAt,
            status: "CONNECTED",
            deletedAt: null,
          },
        });
      } else {
        await tx.adAccount.create({
          data: {
            tenantId: actor.tenantId,
            ...(isCompany
              ? { companyId: pending.unitId }
              : { franchiseId: pending.unitId }),
            platform: "META_ADS",
            externalAccountId: chosen.externalAccountId,
            accessToken: encToken,
            tokenExpiresAt: expiresAt,
            status: "CONNECTED",
          },
        });
      }
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao salvar a conta.",
    };
  }

  await clearMetaPending();
  await recordAudit({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    eventType: "AD_ACCOUNT_CONNECTED",
    resourceType: "ad_account",
    metadata: {
      platform: "META_ADS",
      externalAccountId: chosen.externalAccountId,
      unitId: pending.unitId,
      via: "oauth",
    },
  });

  revalidatePath(`/${slug}/campanhas/contas`);
  return { ok: true, redirectTo: `/${slug}/campanhas/contas` };
}

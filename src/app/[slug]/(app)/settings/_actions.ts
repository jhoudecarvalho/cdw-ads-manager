"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { loadActorContext } from "@/server/auth/load-actor";
import { prisma } from "@/server/db/prisma";

export type UpdateBrandingInput = {
  logoUrl: string | null;
  primaryColor: string | null;
};

export type UpdateBrandingResult =
  | { ok: true }
  | { ok: false; error: string };

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Atualiza branding do tenant (logo + cor primária).
 *
 * Autorização: apenas ADMIN. A tabela `tenants` é "global" (sem RLS), então
 * filtramos sempre pelo `tenantId` da sessão — nunca confiamos no cliente.
 */
export async function updateBrandingAction(
  tenantSlug: string,
  input: UpdateBrandingInput,
): Promise<UpdateBrandingResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão inválida." };

  const actor = await loadActorContext(session);
  if (actor.role !== "ADMIN") {
    return { ok: false, error: "Apenas administradores podem editar o branding." };
  }

  const logoUrl = input.logoUrl?.trim() || null;
  if (logoUrl !== null) {
    try {
      const u = new URL(logoUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { ok: false, error: "A URL da logo deve usar http(s)." };
      }
    } catch {
      return { ok: false, error: "URL da logo inválida." };
    }
  }

  const primaryColor = input.primaryColor?.trim() || null;
  if (primaryColor !== null && !HEX_COLOR.test(primaryColor)) {
    return { ok: false, error: "Cor primária inválida (use #RGB ou #RRGGBB)." };
  }

  await prisma.tenant.update({
    where: { id: actor.tenantId },
    data: { logoUrl, primaryColor },
  });

  revalidatePath(`/${tenantSlug}`, "layout");
  return { ok: true };
}

import { cache } from "react";
import { prisma } from "@/server/db/prisma";
import { isValidTenantSlug } from "./slug";

export { isValidTenantSlug, TENANT_SLUG_REGEX } from "./slug";

export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELED";
  logoUrl: string | null;
  primaryColor: string | null;
};

/**
 * Busca o tenant pelo slug. Envolto em `cache()` do React — dentro do mesmo
 * request, chamar várias vezes (proxy, layout, server components) faz uma
 * única consulta ao banco.
 *
 * Retorna `null` se o slug não existir ou estiver inválido — o chamador
 * decide o que fazer (`notFound()` no layout, redirect, etc.).
 */
export const getTenantBySlug = cache(
  async (slug: string): Promise<TenantSummary | null> => {
    if (!isValidTenantSlug(slug)) return null;

    const tenant = await prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        logoUrl: true,
        primaryColor: true,
      },
    });

    return tenant;
  },
);

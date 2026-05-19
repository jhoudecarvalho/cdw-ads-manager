import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import { isValidTenantSlug } from "@/server/tenant/slug";
import { recordAudit } from "@/server/audit/record";
import type { TenantType, UserRole } from "@/generated/prisma/client";

/**
 * Auth.js v5 — configuração principal.
 *
 * Estratégia: JWT (obrigatório com Credentials provider). O token carrega
 * `tenantId`, `role` e `tenantType` — cada request server-side sabe o
 * contexto sem ir ao banco de novo.
 *
 * Login por tenant: o form passa o `tenantSlug` junto com email/senha. O
 * authorize busca o usuário pelo par `(tenantId, email)` — o mesmo e-mail
 * pode existir em tenants diferentes, sem conflito.
 *
 * SUPER_ADMIN: o login `/admin/login` injeta `tenantSlug = "__system__"`. A
 * regex de `isValidTenantSlug` rejeita esse slug — então abrimos exceção
 * explícita no schema abaixo. O resto do fluxo é igual aos tenants normais.
 */

const SYSTEM_TENANT_SLUG = "__system__";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z
    .string()
    .refine(
      (s) => s === SYSTEM_TENANT_SLUG || isValidTenantSlug(s),
      "slug inválido",
    ),
});

async function authorizeImpl(rawCreds: unknown) {
  const parsed = CredentialsSchema.safeParse(rawCreds);
  if (!parsed.success) return null;

  const { email, password, tenantSlug } = parsed.data;

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null, status: "ACTIVE" },
    select: { id: true, tenantType: true },
  });
  if (!tenant) return null;

  const user = await withTenantScope(tenant.id, async (tx) =>
    tx.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
        passwordHash: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        passwordHash: true,
      },
    }),
  );

  if (!user || !user.passwordHash) {
    await recordAudit({
      tenantId: tenant.id,
      eventType: "USER_LOGIN",
      metadata: { ok: false, reason: "unknown_email", email },
    });
    return null;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await recordAudit({
      tenantId: tenant.id,
      eventType: "USER_LOGIN",
      actorUserId: user.id,
      metadata: { ok: false, reason: "wrong_password" },
    });
    return null;
  }

  // Defesas de canal: SUPER_ADMIN só pode entrar pelo `/admin/login`
  // (tenantSlug = __system__), e o `/admin/login` só aceita SUPER_ADMINs.
  if (tenantSlug === SYSTEM_TENANT_SLUG && user.role !== "SUPER_ADMIN") {
    await recordAudit({
      tenantId: tenant.id,
      eventType: "USER_LOGIN",
      actorUserId: user.id,
      metadata: { ok: false, reason: "not_super_admin" },
    });
    return null;
  }
  if (tenantSlug !== SYSTEM_TENANT_SLUG && user.role === "SUPER_ADMIN") {
    await recordAudit({
      tenantId: tenant.id,
      eventType: "USER_LOGIN",
      actorUserId: user.id,
      metadata: { ok: false, reason: "super_admin_wrong_path" },
    });
    return null;
  }

  await withTenantScope(tenant.id, (tx) =>
    tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  );

  await recordAudit({
    tenantId: tenant.id,
    eventType: "USER_LOGIN",
    actorUserId: user.id,
    metadata: { ok: true },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role,
    tenantId: user.tenantId,
    tenantType: tenant.tenantType,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/",
  },
  providers: [
    Credentials({
      name: "Email e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        tenantSlug: { label: "Tenant", type: "text" },
      },
      authorize: authorizeImpl,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantType = user.tenantType;
      }
      // Auto-cura: tokens emitidos antes do campo `tenantType` existir não
      // têm a info. Faz um round-trip ao banco apenas no primeiro request
      // pós-deploy e nunca mais — a sessão persiste o valor.
      //
      // Try/catch defensivo: se essa query falhar (ex.: schema do Prisma
      // Client em cache mais antigo que o do banco), preferimos seguir com
      // a sessão sem `tenantType` a derrubar a sessão inteira — Auth.js
      // converteria isso em JWTSessionError e o usuário ficaria offline.
      if (!token.tenantType && token.tenantId) {
        try {
          const t = await prisma.tenant.findFirst({
            where: { id: token.tenantId as string },
            select: { tenantType: true },
          });
          if (t) token.tenantType = t.tenantType;
        } catch (e) {
          console.error("[jwt] fallback de tenantType falhou:", e);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantType = token.tenantType as TenantType;
      }
      return session;
    },
  },
});

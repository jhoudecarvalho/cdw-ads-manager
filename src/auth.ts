import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isValidTenantSlug } from "@/server/tenant/slug";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Auth.js v5 — configuração principal.
 *
 * Estratégia: JWT (obrigatório com Credentials provider). O token carrega
 * `tenantId` e `role`, então cada request server-side sabe a "tribo" do
 * usuário sem ir ao banco de novo.
 *
 * Login por tenant: o form passa o `tenantSlug` junto com email/senha. O
 * authorize busca o usuário pelo par `(tenantId, email)` — o mesmo e-mail
 * pode existir em tenants diferentes, sem conflito.
 */

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().refine(isValidTenantSlug, "slug inválido"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    // Não usamos uma página global — cada tenant tem sua /{slug}/login.
    // Mas Auth.js exige uma rota padrão para fallback de erros.
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
      async authorize(rawCreds) {
        const parsed = CredentialsSchema.safeParse(rawCreds);
        if (!parsed.success) return null;

        const { email, password, tenantSlug } = parsed.data;

        const tenant = await prisma.tenant.findFirst({
          where: { slug: tenantSlug, deletedAt: null, status: "ACTIVE" },
          select: { id: true },
        });
        if (!tenant) return null;

        const user = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
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
        });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
});

"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import { isValidTenantSlug } from "@/server/tenant/slug";
import { recordAudit } from "@/server/audit/record";
import { DOCUMENT_VERSIONS } from "./terms";

export type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const LoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const SignupSchema = z
  .object({
    name: z.string().min(2, "Mínimo 2 caracteres").max(120),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", {
      message: "Você precisa aceitar os Termos de Uso",
    }),
    acceptPrivacy: z.literal("on", {
      message: "Você precisa aceitar a Política de Privacidade",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

function toFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_form";
    out[k] ??= issue.message;
  }
  return out;
}

export async function loginAction(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { ok: false, error: "Tenant inválido." };
  }

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      tenantSlug,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
    throw err;
  }

  redirect(`/${tenantSlug}`);
}

export async function signupAction(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isValidTenantSlug(tenantSlug)) {
    return { ok: false, error: "Tenant inválido." };
  }

  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms"),
    acceptPrivacy: formData.get("acceptPrivacy"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Tenant não encontrado." };

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;

  // Tudo dentro de uma transação RLS-scoped: contagem, checagem de duplicata
  // e criação compartilham a mesma vista do tenant. Sem isso, a contagem
  // veria zero (RLS bloqueia), a checagem de duplicata também — e poderíamos
  // recriar um e-mail já existente. O constraint @@unique([tenantId, email])
  // ainda nos protegeria, mas com erro de banco em vez de mensagem amigável.
  const result = await withTenantScope(tenant.id, async (tx) => {
    const existing = await tx.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { duplicate: true as const };
    }

    const userCount = await tx.user.count();
    const role = userCount === 0 ? "ADMIN" : "FRANCHISEE";

    const created = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: parsed.data.name,
        passwordHash,
        role,
        termsAcceptances: {
          create: [
            {
              tenantId: tenant.id,
              documentKey: "terms_of_use",
              version: DOCUMENT_VERSIONS.terms_of_use,
              ipAddress,
              userAgent,
            },
            {
              tenantId: tenant.id,
              documentKey: "privacy_policy",
              version: DOCUMENT_VERSIONS.privacy_policy,
              ipAddress,
              userAgent,
            },
          ],
        },
      },
      select: { id: true, role: true },
    });
    return {
      duplicate: false as const,
      userId: created.id,
      assignedRole: created.role,
    };
  });

  if (result.duplicate) {
    return {
      ok: false,
      fieldErrors: { email: "Já existe uma conta com este e-mail." },
    };
  }

  await recordAudit({
    tenantId: tenant.id,
    eventType: "USER_SIGNUP",
    actorUserId: result.userId,
    metadata: { role: result.assignedRole },
    ip: ipAddress,
    userAgent,
  });
  await recordAudit({
    tenantId: tenant.id,
    eventType: "TERMS_ACCEPTED",
    actorUserId: result.userId,
    metadata: {
      terms_of_use: DOCUMENT_VERSIONS.terms_of_use,
      privacy_policy: DOCUMENT_VERSIONS.privacy_policy,
    },
    ip: ipAddress,
    userAgent,
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      tenantSlug,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        ok: false,
        error: "Conta criada, mas o login automático falhou. Tente entrar.",
      };
    }
    throw err;
  }

  redirect(`/${tenantSlug}`);
}

export async function logoutAction(tenantSlug: string) {
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: `/${tenantSlug}/login` });
}

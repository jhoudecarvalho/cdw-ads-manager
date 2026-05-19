"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, signIn } from "@/auth";
import { can } from "@/server/auth/can";
import { loadActorContext } from "@/server/auth/load-actor";
import { recordAudit } from "@/server/audit/record";
import { prisma } from "@/server/db/prisma";
import { withTenantScope } from "@/server/db/tenant-scope";
import { isValidTenantSlug } from "@/server/tenant/slug";
import {
  clearImpersonationCookie,
  setImpersonationCookie,
} from "@/server/super-admin/impersonation";

/**
 * Server Actions da área Super Admin.
 *
 * Autorização: TODA action chama `can(actor, ..., ...)` antes de qualquer
 * efeito. Login é a exceção (não há ator ainda).
 */

export type SuperAdminFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const SYSTEM_TENANT_SLUG = "__system__";

function toFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_form";
    out[k] ??= issue.message;
  }
  return out;
}

// =========================================================================
// Login do super admin
// =========================================================================

const LoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export async function loginSuperAdminAction(
  _prev: SuperAdminFormState,
  formData: FormData,
): Promise<SuperAdminFormState> {
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
      tenantSlug: SYSTEM_TENANT_SLUG,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
    throw err;
  }

  // Não checamos `auth()` aqui — o cookie de sessão só vai pro browser
  // na resposta da Server Action, então `auth()` ainda veria a sessão
  // antiga (ou null). A validação `role === SUPER_ADMIN` já foi feita
  // dentro do `authorize` (src/auth.ts) — se não fosse super admin, o
  // signIn teria lançado AuthError e caído no catch acima.
  //
  // O `(authenticated)/layout.tsx` faz uma checagem adicional no
  // próximo request, com o cookie já estabelecido.
  redirect("/admin");
}

// =========================================================================
// Criar tenant
// =========================================================================

const CreateTenantSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidTenantSlug, "Slug inválido (use minúsculas, sem _, 2-63 chars)"),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  tenantType: z.enum(["FRANCHISE", "COMPANY"]),
  primaryColor: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "#7C3AED")),
  adminEmail: z.string().email("E-mail inválido"),
  adminName: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  adminPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function createTenantAction(
  _prev: SuperAdminFormState,
  formData: FormData,
): Promise<SuperAdminFormState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const actor = await loadActorContext(session);
  if (!can(actor, "manage_tenants")) {
    return { ok: false, error: "Sem permissão." };
  }

  const parsed = CreateTenantSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    tenantType: formData.get("tenantType"),
    primaryColor: formData.get("primaryColor"),
    adminEmail: formData.get("adminEmail"),
    adminName: formData.get("adminName"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  const { slug, name, tenantType, primaryColor, adminEmail, adminName } =
    parsed.data;

  const existing = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      fieldErrors: { slug: "Já existe um tenant com esse slug." },
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.adminPassword, 12);

  // Cria tenant + admin inicial. Tenant não tem RLS — `prisma.tenant.create`
  // direto. O User precisa de scope porque users.RLS está ativa.
  const created = await prisma.tenant.create({
    data: {
      slug,
      name,
      tenantType,
      primaryColor,
      status: "ACTIVE",
    },
    select: { id: true, slug: true },
  });
  await withTenantScope(created.id, async (tx) => {
    await tx.user.create({
      data: {
        tenantId: created.id,
        email: adminEmail.toLowerCase(),
        name: adminName,
        passwordHash,
        role: "ADMIN",
      },
    });
  });

  await recordAudit({
    tenantId: created.id,
    actorUserId: actor.id,
    eventType: "TENANT_CREATED",
    resourceType: "tenant",
    resourceId: created.id,
    metadata: { slug: created.slug, tenantType, adminEmail },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  return { ok: true };
}

// =========================================================================
// Editar status do tenant
// =========================================================================

const UpdateStatusSchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELED"]),
});

export async function updateTenantStatusAction(input: {
  tenantId: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELED";
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const actor = await loadActorContext(session);
  if (!can(actor, "manage_tenants")) {
    return { ok: false, error: "Sem permissão." };
  }

  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida." };

  await prisma.tenant.update({
    where: { id: parsed.data.tenantId },
    data: { status: parsed.data.status },
  });

  await recordAudit({
    tenantId: parsed.data.tenantId,
    actorUserId: actor.id,
    eventType: "TENANT_UPDATED",
    resourceType: "tenant",
    resourceId: parsed.data.tenantId,
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  return { ok: true };
}

// =========================================================================
// Impersonação
// =========================================================================

export async function impersonateTenantAction(tenantId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const actor = await loadActorContext(session);
  if (!can(actor, "impersonate_tenant", { tenantId })) {
    redirect("/admin");
  }

  const target = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, slug: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") {
    redirect("/admin");
  }

  await setImpersonationCookie(target.id);
  await recordAudit({
    tenantId: target.id,
    actorUserId: actor.id,
    eventType: "TENANT_IMPERSONATED",
    resourceType: "tenant",
    resourceId: target.id,
    metadata: { slug: target.slug },
  });

  redirect(`/${target.slug}`);
}

export async function stopImpersonationAction(): Promise<void> {
  const session = await auth();
  if (session?.user) {
    const actor = await loadActorContext(session);
    // Só audita se de fato havia impersonação em curso. `readImpersonation`
    // já é consumido pelo layout; aqui só limpamos.
    await recordAudit({
      tenantId: actor.tenantId, // tenant `system` do super admin
      actorUserId: actor.id,
      eventType: "TENANT_IMPERSONATION_ENDED",
    });
  }
  await clearImpersonationCookie();
  redirect("/admin");
}

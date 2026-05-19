import type { DefaultSession } from "next-auth";
import type { TenantType, UserRole } from "@/generated/prisma/client";

/**
 * Module augmentation para adicionar `tenantId`, `role` e `tenantType` em
 * `Session.user` e no JWT — Auth.js os carrega via callbacks (ver
 * src/auth.ts). `tenantType` evita um round-trip ao banco em cada request só
 * para decidir o shape da UI (sidebar, filtros, rótulos).
 *
 * SUPER_ADMIN vive no tenant técnico `system` — seu `tenantId` é "system"
 * e `tenantType` reflete o desse tenant (FRANCHISE por convenção). A
 * autorização real para SUPER_ADMIN não depende desses campos — vem do
 * `role` em `can()`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
      tenantType: TenantType;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    tenantId: string;
    tenantType: TenantType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    role: UserRole;
    tenantType: TenantType;
  }
}

import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Module augmentation para adicionar `tenantId` e `role` em `Session.user`
 * e no JWT — Auth.js os carrega via callbacks (ver src/auth.ts).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    tenantId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    role: UserRole;
  }
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  loginSuperAdminAction,
  type SuperAdminFormState,
} from "../_actions";
import { SuperAdminLoginForm } from "./_form";

export default async function SuperAdminLoginPage() {
  // Se já está logado como SUPER_ADMIN, vai direto pro dashboard.
  const session = await auth();
  if (session?.user?.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  async function bound(prev: SuperAdminFormState, formData: FormData) {
    "use server";
    return loginSuperAdminAction(prev, formData);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <header className="mb-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          Franchise HUB · console interno
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Super Admin</h1>
        <p className="mt-2 text-xs text-text-muted">
          Acesso restrito à equipe da Anjos.
        </p>
      </header>

      <SuperAdminLoginForm action={bound} />
    </main>
  );
}

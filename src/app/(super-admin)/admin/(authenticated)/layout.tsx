import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { clearImpersonationCookie } from "@/server/super-admin/impersonation";

/**
 * Shell autenticado da área Super Admin. Tudo aqui dentro exige
 * `role === "SUPER_ADMIN"`.
 */
export default async function SuperAdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/admin/login");
  }

  async function logout() {
    "use server";
    await clearImpersonationCookie();
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="font-mono text-[11px] font-bold uppercase tracking-[2px] text-accent"
          >
            FH · Super Admin
          </Link>
          <nav className="flex items-center gap-4 text-xs">
            <Link href="/admin" className="text-text-muted hover:text-text">
              Dashboard
            </Link>
            <Link
              href="/admin/tenants"
              className="text-text-muted hover:text-text"
            >
              Tenants
            </Link>
            <Link
              href="/admin/units"
              className="text-text-muted hover:text-text"
            >
              Unidades
            </Link>
          </nav>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-[11px] text-text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Sair · {session.user.email}
          </button>
        </form>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}

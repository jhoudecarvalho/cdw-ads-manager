import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { loadActorContext } from "@/server/auth/load-actor";
import { readImpersonation } from "@/server/super-admin/impersonation";
import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * App shell autenticado — porte do design `franchise-ads-dashboard.jsx`.
 *
 * Layout flex puro (sidebar fixa + content scrollável). A sidebar tem
 * estado próprio (open/collapsed) — o trigger é o clique no logo.
 *
 * Guard de sessão:
 *   - Sem sessão → /{slug}/login
 *   - Sessão de outro tenant → /{slug}/login
 *   - SUPER_ADMIN: aceito se houver cookie de impersonação apontando para
 *     este tenant. Sem cookie ou apontando outro tenant → /admin.
 */
export default async function AuthenticatedLayout({ children, params }: Props) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${slug}/login`);
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    redirect(`/${slug}/login`);
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  let impersonating = false;
  if (isSuperAdmin) {
    const imp = await readImpersonation();
    if (!imp || imp.tenantId !== tenant.id) {
      redirect("/admin");
    }
    impersonating = true;
  } else if (session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }

  const actor = await loadActorContext(session);

  const tenantStyle = tenant.primaryColor
    ? ({ "--tenant-primary": tenant.primaryColor } as CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen w-full" style={tenantStyle}>
      <AppSidebar
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        tenantType={tenant.tenantType}
        tenantLogoUrl={tenant.logoUrl}
        userEmail={session.user.email ?? ""}
        userName={session.user.name ?? null}
        userRole={session.user.role}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {impersonating && <ImpersonationBanner tenantName={tenant.name} />}
        <header
          className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3 backdrop-blur"
          style={{ background: "rgba(17, 24, 39, 0.8)" }}
        >
          <TopBar
            tenantId={tenant.id}
            tenantType={tenant.tenantType}
            actor={actor}
          />
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function ImpersonationBanner({ tenantName }: { tenantName: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-yellow-500/30 px-6 py-2 text-xs"
      style={{ background: "rgba(251, 191, 36, 0.10)" }}
    >
      <span className="text-yellow-200">
        ⚠️ Você está visualizando como <strong>{tenantName}</strong> (modo
        impersonação · SUPER_ADMIN).
      </span>
      <form action="/admin/stop-impersonation" method="post">
        <button
          type="submit"
          className="rounded border border-yellow-500/40 px-2 py-1 text-[11px] font-semibold text-yellow-200 transition hover:bg-yellow-500/15"
        >
          Sair da impersonação
        </button>
      </form>
    </div>
  );
}

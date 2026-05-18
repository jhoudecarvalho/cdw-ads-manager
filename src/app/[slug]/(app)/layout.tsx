import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { loadActorContext } from "@/server/auth/load-actor";
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
 */
export default async function AuthenticatedLayout({ children, params }: Props) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${slug}/login`);
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant || session.user.tenantId !== tenant.id) {
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
        tenantLogoUrl={tenant.logoUrl}
        userEmail={session.user.email ?? ""}
        userName={session.user.name ?? null}
        userRole={session.user.role}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3 backdrop-blur"
          style={{ background: "rgba(17, 24, 39, 0.8)" }}
        >
          <TopBar tenantId={tenant.id} actor={actor} />
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

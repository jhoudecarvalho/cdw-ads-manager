import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { loadActorContext } from "@/server/auth/load-actor";
import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * App shell autenticado.
 *
 * Guard de sessão:
 *   1. Sem sessão → /{slug}/login
 *   2. Sessão de outro tenant → /{slug}/login (no futuro: tela "trocar de
 *      conta" com signOut)
 *
 * Acima de cada filho monta: sidebar (com logo dinâmico do tenant + nav),
 * top bar (com filtros de plataforma/região/franquia respeitando o papel
 * do usuário), e área de conteúdo.
 *
 * A cor primária do tenant entra como variável CSS `--tenant-primary`,
 * disponível em qualquer descendente para acentos visuais.
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
    <SidebarProvider style={tenantStyle}>
      <AppSidebar
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        tenantLogoUrl={tenant.logoUrl}
        userEmail={session.user.email ?? ""}
        userName={session.user.name ?? null}
        userRole={session.user.role}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <TopBar tenantId={tenant.id} actor={actor} />
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

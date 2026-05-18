import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Guard de sessão para a área autenticada do tenant.
 *
 * 1. Sem sessão → redirect para /{slug}/login
 * 2. Sessão de outro tenant → redirect para login do tenant correto (e
 *    eventualmente força signOut na própria página). NUNCA mostra dados de
 *    um tenant para sessão de outro.
 *
 * O `[slug]/layout.tsx` pai já validou que o tenant existe; aqui só
 * cuidamos da autorização.
 */
export default async function AuthenticatedLayout({ children, params }: Props) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${slug}/login`);
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant || session.user.tenantId !== tenant.id) {
    // Sessão é de outro tenant. Por enquanto manda para o login do tenant
    // certo — o ideal (a fazer): exibir tela "você está logado em outro
    // tenant, deseja trocar?" com botão de signOut.
    redirect(`/${slug}/login`);
  }

  return <>{children}</>;
}

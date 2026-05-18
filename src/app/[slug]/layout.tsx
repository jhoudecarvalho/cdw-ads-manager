import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Layout escopado por tenant. Toda página em `/{slug}/...` passa por aqui.
 *
 * Aqui acontece o lookup real do tenant no banco — o proxy só validou o
 * formato do slug. Se o tenant não existe ou está suspenso/cancelado,
 * dispara `notFound()` que renderiza `[slug]/not-found.tsx`.
 *
 * O resultado fica em cache de request (via `react.cache()` no resolver),
 * então server components filhos podem chamar `getTenantBySlug` de novo
 * sem custo extra.
 */
export default async function TenantLayout({ children, params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant || tenant.status !== "ACTIVE") {
    notFound();
  }

  return (
    <div
      className="flex flex-1 flex-col"
      data-tenant-id={tenant.id}
      style={
        tenant.primaryColor
          ? ({ "--tenant-primary": tenant.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}

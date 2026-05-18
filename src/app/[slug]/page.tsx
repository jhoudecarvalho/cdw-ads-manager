import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function TenantHomePage({ params }: Props) {
  const { slug } = await params;
  // Cacheado pelo layout — não vai ao banco de novo.
  const tenant = await getTenantBySlug(slug);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <header className="border-b border-zinc-800 pb-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Tenant
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{tenant?.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">/{tenant?.slug}</p>
      </header>

      <section className="mt-10 rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8">
        <h2 className="text-lg font-medium">Fase 1 — fundação pronta ✓</h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
          <li>
            • Resolução de tenant via proxy + layout (com cache de request)
          </li>
          <li>
            • Helper <code>withTenantScope</code> pronto para as policies de RLS
            (Fase 3)
          </li>
          <li>• Banco conectado: Tenant table criada e operante</li>
        </ul>
        <p className="mt-6 text-xs text-zinc-500">
          Próximas fases: autenticação e papéis → modelos + RLS → layout
          completo → integrações Ads → dashboards.
        </p>
      </section>
    </main>
  );
}

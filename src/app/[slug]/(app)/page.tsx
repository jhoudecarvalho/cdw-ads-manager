import { auth, signOut } from "@/auth";
import { withTenantScope } from "@/server/db/tenant-scope";
import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function TenantHomePage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  const session = await auth();
  const user = session!.user;

  // Toda contagem passa pelo `withTenantScope` — `app.current_tenant_id`
  // setado, RLS faz o filtro no banco. Sem scope, retornaria zero.
  const counts = await withTenantScope(user.tenantId, async (tx) => {
    const [regions, franchises, adAccounts, campaigns, metrics] =
      await Promise.all([
        tx.region.count(),
        tx.franchise.count({ where: { deletedAt: null } }),
        tx.adAccount.count(),
        tx.campaign.count(),
        tx.campaignMetricDaily.count(),
      ]);
    return { regions, franchises, adAccounts, campaigns, metrics };
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <header className="flex items-start justify-between border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Tenant
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{tenant?.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">/{tenant?.slug}</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/${slug}/login` });
          }}
        >
          <div className="text-right">
            <p className="text-xs text-zinc-500">Logado como</p>
            <p className="text-sm text-zinc-200">{user.email}</p>
            <p className="text-xs text-zinc-500">
              {user.role}
              {user.name ? ` · ${user.name}` : ""}
            </p>
            <button
              type="submit"
              className="mt-2 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-900"
            >
              Sair
            </button>
          </div>
        </form>
      </header>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500">
          Visão geral (dados isolados via RLS)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Regiões" value={counts.regions} />
          <Stat label="Franquias" value={counts.franchises} />
          <Stat label="Contas de anúncio" value={counts.adAccounts} />
          <Stat label="Campanhas" value={counts.campaigns} />
          <Stat label="Métricas diárias" value={counts.metrics} />
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8">
        <h2 className="text-lg font-medium">
          Fase 3 — modelos de negócio + RLS ✓
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
          <li>
            • 11 tabelas com <code>tenantId</code>, todas com policy{" "}
            <code>tenant_isolation</code> (USING + WITH CHECK)
          </li>
          <li>
            • Role <code>franchise_hub_app</code> sem BYPASSRLS — policies
            ativas mesmo para o dono do schema
          </li>
          <li>
            • 8 testes de isolamento contra Neon real provam: SELECT sem scope =
            0, INSERT cross-tenant falha, UPDATE/DELETE cross-tenant não afetam
            linhas
          </li>
          <li>
            • <code>loadActorContext()</code> popula <code>franchiseIds</code>/
            <code>regionIds</code> de REGIONAL e FRANCHISEE
          </li>
        </ul>
        <p className="mt-6 text-xs text-zinc-500">
          Próximo: <strong>Fase 4</strong> — sidebar com tema escuro, menu
          Campanhas Ads expansível, dashboards Recharts (Visão Geral, Google
          Ads, Meta Ads, Franquias, Regiões, Performance, Financeiro,
          Comparativo).
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

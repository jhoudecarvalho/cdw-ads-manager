import { auth, signOut } from "@/auth";
import { getTenantBySlug } from "@/server/tenant/resolver";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function TenantHomePage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  const session = await auth();
  const user = session!.user;

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

      <section className="mt-10 rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8">
        <h2 className="text-lg font-medium">
          Fase 2 — autenticação e papéis ✓
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
          <li>• Login/Signup por tenant com Auth.js v5 (Credentials + JWT)</li>
          <li>• Aceite versionado de Termos e Política (LGPD)</li>
          <li>
            • Função <code>can()</code> central — checada no servidor
          </li>
          <li>
            • Guard de sessão em <code>(app)/layout.tsx</code> impede acesso
            entre tenants
          </li>
        </ul>
        <p className="mt-6 text-xs text-zinc-500">
          Próximo: <strong>Fase 3</strong> — Region, Franchise, AdAccount,
          Campaign, CampaignMetricDaily + RLS no Postgres.
        </p>
      </section>
    </main>
  );
}

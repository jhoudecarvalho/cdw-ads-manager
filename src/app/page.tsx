import Link from "next/link";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function RootLandingPage() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Franchise HUB</h1>
      <p className="mt-3 text-sm text-zinc-400">
        Plataforma de gestão de campanhas de anúncios para redes de franquias.
      </p>

      <section className="mt-12">
        <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Tenants disponíveis (dev)
        </h2>
        {tenants.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">
            Nenhum tenant cadastrado. Rode{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-200">
              npm run db:seed
            </code>{" "}
            para criar <strong>anjos</strong> e <strong>kgepel</strong>.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tenants.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/${t.slug}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <span className="text-sm font-medium text-zinc-100">
                    {t.name}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">/{t.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

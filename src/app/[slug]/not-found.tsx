import Link from "next/link";

export default function TenantNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-widest text-zinc-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Tenant não encontrado</h1>
      <p className="mt-3 text-sm text-zinc-400">
        O endereço que você acessou não corresponde a nenhuma franqueadora ativa
        no Franchise HUB.
      </p>
      <Link
        href="/"
        className="mt-8 self-center rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-900"
      >
        Voltar para a página inicial
      </Link>
    </main>
  );
}

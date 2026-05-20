import { notFound } from "next/navigation";
import { ApiInfoFooter } from "@/components/api-info-footer";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
import { loadFranchiseRankings } from "@/server/metrics/franchise-rankings";
import { FranchisesGrid } from "./_grid";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function FranquiasPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  // Página exclusiva do modo FRANCHISE — em COMPANY o caminho correto é
  // `campanhas/empresas`.
  if (actor.tenantType !== "FRANCHISE") notFound();
  const filters = parseDashboardFilters(sp);
  const rows = await loadFranchiseRankings(actor.tenantId, actor, filters);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {filters.rangeDays ?? 14} dias · ranking por ROAS
        </p>
        <h1 className="mt-1 text-xl font-extrabold">🏪 Franquias</h1>
      </div>
      <FranchisesGrid rows={rows} />
      <ApiInfoFooter />
    </div>
  );
}

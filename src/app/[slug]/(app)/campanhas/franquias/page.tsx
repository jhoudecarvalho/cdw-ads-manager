import { auth } from "@/auth";
import { ApiInfoFooter } from "@/components/api-info-footer";
import { parseDashboardFilters } from "@/lib/filters";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadFranchiseRankings } from "@/server/metrics/franchise-rankings";
import { FranchisesGrid } from "./_grid";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function FranquiasPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
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

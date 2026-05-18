import { auth } from "@/auth";
import { DashboardHeader } from "@/components/dashboard-header";
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
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Franquias"
        subtitle={`${slug} · últimos ${filters.rangeDays ?? 14} dias · ranking por ROAS`}
      />
      <FranchisesGrid rows={rows} />
    </div>
  );
}

import { auth } from "@/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { parseDashboardFilters } from "@/lib/filters";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadCampaignsList } from "@/server/metrics/campaigns-list";
import { CampaignsTable } from "./_table";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CampanhasListagemPage({
  params,
  searchParams,
}: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const rows = await loadCampaignsList(actor.tenantId, actor, filters);

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Campanhas"
        subtitle={`${slug} · últimos ${filters.rangeDays ?? 14} dias`}
      />
      <CampaignsTable rows={rows} />
    </div>
  );
}

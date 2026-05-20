import { ApiInfoFooter } from "@/components/api-info-footer";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
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
  const actor = await requireActor(slug);
  const filters = parseDashboardFilters(sp);
  const rows = await loadCampaignsList(actor.tenantId, actor, filters);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {filters.rangeDays ?? 14} dias
        </p>
        <h1 className="mt-1 text-xl font-extrabold">📋 Campanhas</h1>
      </div>
      <div className="rounded-[14px] border border-border bg-surface p-5">
        <CampaignsTable rows={rows} />
      </div>
      <ApiInfoFooter />
    </div>
  );
}

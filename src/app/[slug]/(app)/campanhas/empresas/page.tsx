import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ApiInfoFooter } from "@/components/api-info-footer";
import { parseDashboardFilters } from "@/lib/filters";
import { can } from "@/server/auth/can";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadCompanyRankings } from "@/server/metrics/company-rankings";
import { CompaniesGrid } from "./_grid";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

/**
 * Listagem de empresas — equivalente a `campanhas/franquias` mas para o modo
 * COMPANY. Mostra ranking por ROAS, sem coluna de região, com toggle de
 * status para quem tem `manage_companies`.
 */
export default async function EmpresasPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  // Página exclusiva do modo COMPANY — em FRANCHISE o caminho correto é
  // `campanhas/franquias`.
  if (actor.tenantType !== "COMPANY") notFound();

  const filters = parseDashboardFilters(sp);
  const rows = await loadCompanyRankings(actor.tenantId, actor, filters);
  const canManage = can(actor, "manage_companies", {
    tenantId: actor.tenantId,
  });

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · últimos {filters.rangeDays ?? 14} dias · ranking por ROAS
        </p>
        <h1 className="mt-1 text-xl font-extrabold">🏢 Empresas</h1>
      </div>
      <CompaniesGrid rows={rows} slug={slug} canManage={canManage} />
      <ApiInfoFooter />
    </div>
  );
}

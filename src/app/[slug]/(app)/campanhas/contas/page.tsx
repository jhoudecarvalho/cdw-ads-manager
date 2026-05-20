import { ApiInfoFooter } from "@/components/api-info-footer";
import { can } from "@/server/auth/can";
import { requireActor } from "@/server/auth/require-actor";
import { listAdAccounts, listUnitOptions } from "@/server/ads/accounts";
import { getTenantModule } from "@/server/tenant/tenant-modules";
import {
  createAdAccountAction,
  type AdAccountFormState,
} from "./_actions";
import { AdAccountsTable } from "./_table";
import { ConnectAccountForm } from "./_form";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Contas de Anúncio — lista as contas Google/Meta conectadas e permite
 * adicionar/desconectar. Em modo mock as contas não têm token (OAuth real
 * é etapa futura), mas já recebem campanhas/métricas no próximo sync.
 */
export default async function ContasPage({ params }: Props) {
  const { slug } = await params;
  const actor = await requireActor(slug);
  const mod = getTenantModule(actor.tenantType);

  const [accounts, units] = await Promise.all([
    listAdAccounts(actor.tenantId, actor),
    listUnitOptions(actor.tenantId, actor),
  ]);

  const canManage = can(actor, "manage_ad_accounts", {
    tenantId: actor.tenantId,
  });

  async function bound(prev: AdAccountFormState, formData: FormData) {
    "use server";
    return createAdAccountAction(slug, prev, formData);
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · integrações
        </p>
        <h1 className="mt-1 text-xl font-extrabold">🔌 Contas de Anúncio</h1>
        <p className="mt-1 text-xs text-text-muted">
          Contas Google Ads / Meta Ads vinculadas às suas{" "}
          {mod.unitLabelPlural.toLowerCase()}. A conexão OAuth real entra em
          breve — por ora as contas usam dados de demonstração.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AdAccountsTable
          rows={accounts}
          slug={slug}
          canManage={canManage}
          unitLabel={mod.unitLabel}
        />
        {canManage && (
          <aside className="space-y-3 rounded-md border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Conectar conta</h2>
            <p className="text-xs text-text-muted">
              Vincule uma conta a uma {mod.unitLabel.toLowerCase()}. Sem OAuth
              ainda — informe o ID da conta manualmente.
            </p>
            <ConnectAccountForm
              action={bound}
              units={units}
              unitLabel={mod.unitLabel}
            />
          </aside>
        )}
      </div>

      <ApiInfoFooter />
    </div>
  );
}

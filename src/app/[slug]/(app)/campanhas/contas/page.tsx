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
          <div className="space-y-4">
            {/* Conexão real via OAuth do Meta. Form GET nativo monta a
                query string e navega pro route handler que inicia o fluxo. */}
            <aside className="space-y-3 rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">Conectar via Meta</h2>
              <p className="text-xs text-text-muted">
                Autentique no Meta e escolha a conta de anúncio para vincular a
                uma {mod.unitLabel.toLowerCase()}.
              </p>
              {units.length > 0 ? (
                <form
                  method="get"
                  action="/api/ads/meta/start"
                  className="space-y-3"
                >
                  <input type="hidden" name="slug" value={slug} />
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
                      {mod.unitLabel}
                    </span>
                    <select
                      name="unitId"
                      defaultValue={units[0]!.id}
                      className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-md border border-[#0668E1]/40 bg-[#0668E1]/15 px-4 py-2 text-xs font-semibold text-[#3b82f6] transition hover:bg-[#0668E1]/25"
                  >
                    Conectar via Meta
                  </button>
                </form>
              ) : (
                <p className="text-xs text-text-muted">
                  Nenhuma unidade disponível para vincular.
                </p>
              )}
            </aside>

            <aside className="space-y-3 rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">Adicionar manualmente</h2>
              <p className="text-xs text-text-muted">
                Cadastro mock (sem OAuth) — informe o ID da conta. Útil para
                Google Ads enquanto a conexão real não entra.
              </p>
              <ConnectAccountForm
                action={bound}
                units={units}
                unitLabel={mod.unitLabel}
              />
            </aside>
          </div>
        )}
      </div>

      <ApiInfoFooter />
    </div>
  );
}

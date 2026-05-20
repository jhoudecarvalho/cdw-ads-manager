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
import { ConnectMetaButton } from "./_connect-meta";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Mapeia chaves de erro conhecidas (vindas dos route handlers) em mensagens. */
function errorMessage(error: string | undefined): string | null {
  if (!error) return null;
  switch (error) {
    case "meta_not_configured":
      return "Meta não configurado no servidor — defina META_ADS_CLIENT_ID e META_ADS_CLIENT_SECRET no .env e reinicie o app.";
    case "forbidden":
      return "Você não tem permissão para conectar contas nesta unidade.";
    case "cancelled":
      return "Conexão com o Meta cancelada.";
    default:
      // Erros do callback chegam com a mensagem já legível (encodeURIComponent).
      return decodeURIComponent(error);
  }
}

/**
 * Contas de Anúncio — lista as contas Google/Meta conectadas e permite
 * adicionar/desconectar. Contas conectadas via OAuth (com token) puxam dados
 * reais no sync; as mock continuam com dados de demonstração.
 */
export default async function ContasPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  const mod = getTenantModule(actor.tenantType);
  const error = errorMessage(sp.error);

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

      {error && (
        <div
          className="rounded-md border border-red-500/30 px-4 py-3 text-sm text-red-300"
          style={{ background: "rgba(248, 113, 113, 0.10)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AdAccountsTable
          rows={accounts}
          slug={slug}
          canManage={canManage}
          unitLabel={mod.unitLabel}
        />
        {canManage && (
          <div className="space-y-4">
            {/* Conexão real via OAuth do Meta. Navegação top-level (não form)
                pra não esbarrar na CSP form-action — ver _connect-meta.tsx. */}
            <aside className="space-y-3 rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">Conectar via Meta</h2>
              <p className="text-xs text-text-muted">
                Autentique no Meta e escolha a conta de anúncio para vincular a
                uma {mod.unitLabel.toLowerCase()}.
              </p>
              <ConnectMetaButton
                slug={slug}
                units={units}
                unitLabel={mod.unitLabel}
              />
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

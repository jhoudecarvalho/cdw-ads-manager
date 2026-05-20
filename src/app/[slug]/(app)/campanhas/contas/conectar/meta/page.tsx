import { redirect } from "next/navigation";
import { ApiInfoFooter } from "@/components/api-info-footer";
import { can } from "@/server/auth/can";
import { requireActor } from "@/server/auth/require-actor";
import { readMetaPending } from "@/server/ads/meta-pending";
import {
  confirmMetaAccountAction,
  type ConfirmState,
} from "./_actions";
import { SelectAccountForm } from "./_select-form";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Tela de seleção da conta Meta após o OAuth. Lê o cookie pending (gravado
 * pelo callback) e lista as ad accounts que o usuário autorizou, para ele
 * escolher qual vincular à unidade.
 */
export default async function ConectarMetaPage({ params }: Props) {
  const { slug } = await params;
  const actor = await requireActor(slug);
  if (!can(actor, "manage_ad_accounts", { tenantId: actor.tenantId })) {
    redirect(`/${slug}/campanhas/contas`);
  }

  const pending = await readMetaPending();
  // Sem cookie (expirou, ou acesso direto à URL) → volta pra lista.
  if (!pending || pending.slug !== slug) {
    redirect(`/${slug}/campanhas/contas`);
  }

  async function bound(prev: ConfirmState, formData: FormData) {
    "use server";
    return confirmMetaAccountAction(slug, prev, formData);
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · conectar Meta Ads
        </p>
        <h1 className="mt-1 text-xl font-extrabold">
          Escolha a conta de anúncio
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          Autenticação concluída. Selecione qual conta do Meta vincular a esta
          unidade.
        </p>
      </div>

      <SelectAccountForm
        action={bound}
        accounts={pending.accounts}
        cancelHref={`/${slug}/campanhas/contas`}
      />

      <ApiInfoFooter />
    </div>
  );
}

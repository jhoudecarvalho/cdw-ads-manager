import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/server/auth/can";
import { loadActorContext } from "@/server/auth/load-actor";
import {
  createCompanyAction,
  type CompanyFormState,
} from "../_actions";
import { CompanyForm } from "./_form";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CadastrarEmpresaPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  const actor = await loadActorContext(session!);

  if (actor.tenantType !== "COMPANY") notFound();
  if (!can(actor, "manage_companies", { tenantId: actor.tenantId })) {
    notFound();
  }

  async function bound(prev: CompanyFormState, formData: FormData) {
    "use server";
    return createCompanyAction(slug, prev, formData);
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {slug} · cadastro
        </p>
        <h1 className="mt-1 text-xl font-extrabold">➕ Cadastrar Empresa</h1>
        <p className="mt-1 text-xs text-text-muted">
          O código sequencial (EMP-0001…) é gerado automaticamente.
        </p>
      </div>

      <CompanyForm action={bound} listHref={`/${slug}/campanhas/empresas`} />
    </div>
  );
}

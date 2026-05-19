"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CompanyFormState } from "../_actions";

type Props = {
  action: (
    state: CompanyFormState,
    formData: FormData,
  ) => Promise<CompanyFormState>;
  listHref: string;
};

const INITIAL: CompanyFormState = { ok: false };

export function CompanyForm({ action, listHref }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const router = useRouter();

  // Redireciona após sucesso — não usamos `redirect()` no servidor para
  // permitir uma transição suave com `router.refresh`.
  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <Field
        label="Nome da empresa"
        name="name"
        required
        error={state.fieldErrors?.name}
        placeholder="Ex.: Padaria Trigo Dourado"
      />
      <Field
        label="Setor"
        name="sector"
        error={state.fieldErrors?.sector}
        placeholder="Ex.: Alimentação"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="CNPJ (opcional)"
          name="cnpj"
          error={state.fieldErrors?.cnpj}
          placeholder="00.000.000/0000-00"
        />
        <Field
          label="E-mail de contato (opcional)"
          name="contactEmail"
          type="email"
          error={state.fieldErrors?.contactEmail}
          placeholder="contato@empresa.com"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Cadastrar Empresa"}
        </button>
        <Link
          href={listHref}
          className="text-xs text-text-muted underline-offset-2 hover:text-text hover:underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { type SuperAdminFormState } from "../../_actions";

const INITIAL: SuperAdminFormState = { ok: false };

export function CreateTenantForm({
  action,
}: {
  action: (
    state: SuperAdminFormState,
    formData: FormData,
  ) => Promise<SuperAdminFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <Field label="Slug" name="slug" required error={state.fieldErrors?.slug} />
      <Field label="Nome" name="name" required error={state.fieldErrors?.name} />
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          Tipo
        </span>
        <select
          name="tenantType"
          defaultValue="FRANCHISE"
          className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          <option value="FRANCHISE">Franquia (Region → Franchise)</option>
          <option value="COMPANY">Empresa (lista plana)</option>
        </select>
      </label>
      <Field
        label="Cor primária (hex)"
        name="primaryColor"
        placeholder="#7C3AED"
        error={state.fieldErrors?.primaryColor}
      />
      <div className="my-2 h-px bg-border" />
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
        Admin inicial
      </p>
      <Field
        label="Nome do admin"
        name="adminName"
        required
        error={state.fieldErrors?.adminName}
      />
      <Field
        label="E-mail do admin"
        name="adminEmail"
        type="email"
        required
        error={state.fieldErrors?.adminEmail}
      />
      <Field
        label="Senha inicial"
        name="adminPassword"
        type="password"
        required
        error={state.fieldErrors?.adminPassword}
      />

      {state.error && (
        <p className="text-xs text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
      >
        {pending ? "Criando…" : "Criar tenant"}
      </button>
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
        className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

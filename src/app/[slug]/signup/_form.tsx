"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type FormState } from "@/server/auth/actions";
import { DOCUMENT_VERSIONS } from "@/server/auth/terms";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  loginHref: string;
};

const INITIAL: FormState = { ok: false };

export function SignupForm({ action, loginHref }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Nome"
        name="name"
        autoComplete="name"
        required
        error={state.fieldErrors?.name}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
      />
      <Field
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />

      <div className="space-y-2 pt-2">
        <Checkbox
          name="acceptTerms"
          required
          error={state.fieldErrors?.acceptTerms}
        >
          Li e aceito os{" "}
          <Link href="/terms" className="text-zinc-300 underline">
            Termos de Uso
          </Link>{" "}
          <span className="text-zinc-600">
            (v. {DOCUMENT_VERSIONS.terms_of_use})
          </span>
        </Checkbox>
        <Checkbox
          name="acceptPrivacy"
          required
          error={state.fieldErrors?.acceptPrivacy}
        >
          Li e aceito a{" "}
          <Link href="/privacy" className="text-zinc-300 underline">
            Política de Privacidade
          </Link>{" "}
          <span className="text-zinc-600">
            (v. {DOCUMENT_VERSIONS.privacy_policy})
          </span>
        </Checkbox>
      </div>

      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-zinc-200"
      >
        {pending ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="pt-2 text-center text-xs text-zinc-500">
        Já tem conta?{" "}
        <a href={loginHref} className="text-zinc-300 underline">
          Entrar
        </a>
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-600"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

function Checkbox({
  name,
  required,
  error,
  children,
}: {
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-start gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          name={name}
          required={required}
          className="mt-0.5"
        />
        <span>{children}</span>
      </label>
      {error && <p className="ml-6 mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

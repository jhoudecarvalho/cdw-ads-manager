"use client";

import { useActionState } from "react";
import { type FormState } from "@/server/auth/actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  signupHref: string;
};

const INITIAL: FormState = { ok: false };

export function LoginForm({ action, signupHref }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
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
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />

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
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <p className="pt-2 text-center text-xs text-zinc-500">
        Não tem conta?{" "}
        <a href={signupHref} className="text-zinc-300 underline">
          Criar conta
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

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { UnitOption } from "@/server/ads/accounts";
import { type AdAccountFormState } from "./_actions";

const INITIAL: AdAccountFormState = { ok: false };

export function ConnectAccountForm({
  action,
  units,
  unitLabel,
}: {
  action: (
    state: AdAccountFormState,
    formData: FormData,
  ) => Promise<AdAccountFormState>;
  units: UnitOption[];
  unitLabel: string;
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
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          Plataforma
        </span>
        <select
          name="platform"
          defaultValue="GOOGLE_ADS"
          className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          <option value="GOOGLE_ADS">Google Ads</option>
          <option value="META_ADS">Meta Ads</option>
        </select>
      </label>

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          ID da conta
        </span>
        <input
          name="externalAccountId"
          placeholder="ex.: 123-456-7890"
          className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        {state.fieldErrors?.externalAccountId && (
          <p className="mt-1 text-xs text-red-400">
            {state.fieldErrors.externalAccountId}
          </p>
        )}
      </label>

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {unitLabel}
        </span>
        <select
          name="unitId"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.unitId && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.unitId}</p>
        )}
      </label>

      {state.error && (
        <p className="text-xs text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || units.length === 0}
        className="w-full rounded-md border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
      >
        {pending ? "Conectando…" : "Conectar conta"}
      </button>
      {units.length === 0 && (
        <p className="text-xs text-text-muted">
          Nenhuma unidade disponível para vincular.
        </p>
      )}
    </form>
  );
}

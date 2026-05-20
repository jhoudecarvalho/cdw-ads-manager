"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MetaAdAccountOption } from "@/server/ads/meta-oauth";
import { type ConfirmState } from "./_actions";

const INITIAL: ConfirmState = { ok: false };

export function SelectAccountForm({
  action,
  accounts,
  cancelHref,
}: {
  action: (state: ConfirmState, formData: FormData) => Promise<ConfirmState>;
  accounts: MetaAdAccountOption[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const router = useRouter();
  const [selected, setSelected] = useState(
    accounts[0]?.externalAccountId ?? "",
  );

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  if (accounts.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-4 text-sm text-text-muted">
        Nenhuma conta de anúncio encontrada nesse login do Meta.{" "}
        <Link href={cancelHref} className="text-accent underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      <input type="hidden" name="externalAccountId" value={selected} />
      <div className="space-y-2">
        {accounts.map((a) => (
          <label
            key={a.externalAccountId}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 transition hover:border-border-light"
            style={{
              borderColor:
                selected === a.externalAccountId
                  ? "var(--accent)"
                  : undefined,
            }}
          >
            <input
              type="radio"
              name="pick"
              checked={selected === a.externalAccountId}
              onChange={() => setSelected(a.externalAccountId)}
            />
            <span className="flex-1">
              <span className="text-sm font-medium text-text">{a.name}</span>
              <span className="ml-2 font-mono text-[11px] text-text-muted">
                {a.externalAccountId}
              </span>
            </span>
          </label>
        ))}
      </div>

      {state.error && (
        <p className="text-xs text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending || !selected}
          className="rounded-md border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
        >
          {pending ? "Vinculando…" : "Vincular conta"}
        </button>
        <Link
          href={cancelHref}
          className="text-xs text-text-muted underline-offset-2 hover:text-text hover:underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

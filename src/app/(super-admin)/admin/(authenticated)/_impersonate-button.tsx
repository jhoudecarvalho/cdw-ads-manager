"use client";

import { useTransition } from "react";
import { impersonateTenantAction } from "../_actions";

export function ImpersonateButton({
  tenantId,
  disabled,
}: {
  tenantId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(() => {
          void impersonateTenantAction(tenantId);
        })
      }
      className="rounded border border-border px-2 py-1 text-[11px] text-text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
    >
      {pending ? "..." : "Entrar como"}
    </button>
  );
}

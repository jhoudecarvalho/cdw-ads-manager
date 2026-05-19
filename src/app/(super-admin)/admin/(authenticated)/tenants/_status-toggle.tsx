"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTenantStatusAction } from "../../_actions";

type Status = "ACTIVE" | "SUSPENDED" | "CANCELED";

export function StatusToggle({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await updateTenantStatusAction({
            tenantId,
            status: e.target.value as Status,
          });
          router.refresh();
        })
      }
      className="rounded border border-border bg-surface-alt px-2 py-1 text-[11px] text-text outline-none transition hover:border-border-light focus:border-accent disabled:opacity-40"
    >
      <option value="ACTIVE">ACTIVE</option>
      <option value="SUSPENDED">SUSPENDED</option>
      <option value="CANCELED">CANCELED</option>
    </select>
  );
}

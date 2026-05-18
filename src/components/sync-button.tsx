"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runSyncAction, type SyncActionResult } from "@/server/ads/actions";

export function SyncButton({ tenantSlug }: { tenantSlug: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncActionResult | null>(null);

  function onClick() {
    startTransition(async () => {
      const r = await runSyncAction(tenantSlug);
      setResult(r);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={onClick}
        disabled={pending}
        size="sm"
        variant="outline"
        className="gap-2"
      >
        <RefreshCw
          className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
        />
        {pending ? "Sincronizando…" : "Atualizar agora"}
      </Button>
      {result && (
        <span
          className={
            result.ok ? "text-xs text-emerald-400" : "text-xs text-red-400"
          }
        >
          {result.ok
            ? `✓ ${result.summary.syncedAccounts} contas · ${result.summary.totalCampaigns} campanhas · ${result.summary.totalMetrics} métricas${
                result.summary.failedAccounts > 0
                  ? ` · ${result.summary.failedAccounts} com falha`
                  : ""
              }`
            : `✗ ${result.error}`}
        </span>
      )}
    </div>
  );
}

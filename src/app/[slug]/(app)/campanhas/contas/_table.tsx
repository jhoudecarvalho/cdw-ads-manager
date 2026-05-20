"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { AdAccountRow } from "@/server/ads/accounts";
import { disconnectAdAccountAction } from "./_actions";

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
};

export function AdAccountsTable({
  rows,
  slug,
  canManage,
  unitLabel,
}: {
  rows: AdAccountRow[];
  slug: string;
  canManage: boolean;
  unitLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma conta conectada ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-[10px] uppercase">
              Plataforma
            </TableHead>
            <TableHead className="font-mono text-[10px] uppercase">
              ID da conta
            </TableHead>
            <TableHead className="font-mono text-[10px] uppercase">
              {unitLabel}
            </TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase">
              Campanhas
            </TableHead>
            <TableHead className="font-mono text-[10px] uppercase">
              Status
            </TableHead>
            <TableHead className="font-mono text-[10px] uppercase">
              Último sync
            </TableHead>
            {canManage && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                {PLATFORM_LABEL[a.platform] ?? a.platform}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {a.externalAccountId}
              </TableCell>
              <TableCell>{a.unitName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {a.campaignCount}
              </TableCell>
              <TableCell>
                <StatusBadge status={a.status} />
              </TableCell>
              <TableCell className="text-xs text-text-muted">
                {a.lastSyncAt
                  ? a.lastSyncAt.toLocaleDateString("pt-BR")
                  : "nunca"}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <DisconnectButton slug={slug} adAccountId={a.id} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const connected = status === "CONNECTED";
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{
        background: connected
          ? "rgba(52, 211, 153, 0.15)"
          : "rgba(251, 191, 36, 0.15)",
        color: connected ? "var(--success)" : "var(--warning)",
      }}
    >
      {connected ? "Conectada" : status}
    </span>
  );
}

function DisconnectButton({
  slug,
  adAccountId,
}: {
  slug: string;
  adAccountId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Desconectar esta conta? Campanhas históricas são mantidas."))
          return;
        startTransition(async () => {
          const r = await disconnectAdAccountAction(slug, { adAccountId });
          if (r.ok) router.refresh();
          else alert(r.error ?? "Falha ao desconectar.");
        });
      }}
      className="rounded border border-border px-2 py-1 text-[11px] text-text-muted transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
    >
      {pending ? "..." : "Desconectar"}
    </button>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { brl, int, multiplier, pct } from "@/lib/format";
import type { CompanyRanking } from "@/server/metrics/company-rankings";
import { setCompanyStatusAction } from "./_actions";

const PAGE_SIZE = 12;

/**
 * Grid de empresas — espelha `franquias/_grid.tsx` mas sem coluna de região;
 * exibe `sector` como tag e oferece toggle de status (ACTIVE/INACTIVE).
 */
export function CompaniesGrid({
  rows,
  slug,
  canManage,
}: {
  rows: CompanyRanking[];
  slug: string;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.externalCode.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const maxRoas = Math.max(0.01, ...rows.map((r) => r.roas));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por empresa, código ou setor…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="h-8 max-w-xs"
          />
          <span className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString("pt-BR")} empresas · ordenadas por
            ROAS
          </span>
        </div>
        {canManage && (
          <Link
            href={`/${slug}/campanhas/empresas/cadastrar`}
            className="rounded-md border border-border bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15"
          >
            + Cadastrar Empresa
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((co, idx) => {
            const rank = page * PAGE_SIZE + idx + 1;
            const roasShare = maxRoas > 0 ? (co.roas / maxRoas) * 100 : 0;
            const split = totalSplit(co.byPlatform);
            return (
              <Card key={co.companyId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      <span className="text-muted-foreground">
                        #{String(rank).padStart(2, "0")}
                      </span>{" "}
                      {co.name}
                    </CardTitle>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {co.sector}
                    </span>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{co.externalCode}</span>
                    <StatusBadge status={co.status} />
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Invest." value={brl(co.spend)} />
                    <Stat label="Receita" value={brl(co.revenue)} />
                    <Stat label="ROAS" value={multiplier(co.roas)} bold />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>ROAS vs melhor</span>
                      <span>{multiplier(co.roas)}</span>
                    </div>
                    <Progress value={roasShare} className="h-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Conv." value={int(co.conversions)} />
                    <Stat label="CTR" value={pct(co.ctr)} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Split por plataforma
                    </div>
                    <div className="flex h-2 overflow-hidden rounded">
                      <div
                        className="bg-blue-500"
                        style={{ width: `${split.googlePct}%` }}
                        title={`Google ${split.googlePct.toFixed(0)}%`}
                      />
                      <div
                        className="bg-pink-500"
                        style={{ width: `${split.metaPct}%` }}
                        title={`Meta ${split.metaPct.toFixed(0)}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Google {split.googlePct.toFixed(0)}%</span>
                      <span>Meta {split.metaPct.toFixed(0)}%</span>
                    </div>
                  </div>
                  {canManage && (
                    <ToggleStatusButton
                      slug={slug}
                      companyId={co.companyId}
                      currentStatus={co.status}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          bold ? "text-sm font-semibold tabular-nums" : "text-sm tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{
        background: active ? "rgba(52, 211, 153, 0.15)" : "rgba(136, 150, 171, 0.15)",
        color: active ? "var(--success)" : "var(--text-muted)",
      }}
    >
      {active ? "Ativa" : "Inativa"}
    </span>
  );
}

function ToggleStatusButton({
  slug,
  companyId,
  currentStatus,
}: {
  slug: string;
  companyId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const label = currentStatus === "ACTIVE" ? "Desativar" : "Reativar";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setCompanyStatusAction(slug, {
            companyId,
            status: next,
          });
          if (r.ok) router.refresh();
        })
      }
      className="w-full rounded border border-border px-2 py-1 text-[11px] text-text-muted transition hover:border-border-light hover:text-text disabled:opacity-40"
    >
      {pending ? "..." : label}
    </button>
  );
}

function totalSplit(byPlatform: CompanyRanking["byPlatform"]) {
  const total = byPlatform.GOOGLE_ADS.spend + byPlatform.META_ADS.spend;
  if (total === 0) return { googlePct: 50, metaPct: 50 };
  return {
    googlePct: (byPlatform.GOOGLE_ADS.spend / total) * 100,
    metaPct: (byPlatform.META_ADS.spend / total) * 100,
  };
}

"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { brl, int, multiplier, pct } from "@/lib/format";
import type { FranchiseRanking } from "@/server/metrics/franchise-rankings";

const PAGE_SIZE = 12;

export function FranchisesGrid({ rows }: { rows: FranchiseRanking[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        r.regionName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const maxRoas = Math.max(0.01, ...rows.map((r) => r.roas));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por franquia, cidade, UF ou região…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="h-8 max-w-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} franquias · ordenadas por
          ROAS
        </span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma franquia bate com a busca.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((f, idx) => {
            const rank = page * PAGE_SIZE + idx + 1;
            const roasShare = maxRoas > 0 ? (f.roas / maxRoas) * 100 : 0;
            const split = totalSplit(f.byPlatform);
            return (
              <Card key={f.franchiseId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      <span className="text-muted-foreground">
                        #{String(rank).padStart(2, "0")}
                      </span>{" "}
                      {f.name}
                    </CardTitle>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.regionName} · {f.state}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.city}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="Invest." value={brl(f.spend)} />
                    <Stat label="Receita" value={brl(f.revenue)} />
                    <Stat label="ROAS" value={multiplier(f.roas)} bold />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>ROAS vs melhor da rede</span>
                      <span>{multiplier(f.roas)}</span>
                    </div>
                    <Progress value={roasShare} className="h-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Conv." value={int(f.conversions)} />
                    <Stat label="CTR" value={pct(f.ctr)} />
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

function totalSplit(byPlatform: FranchiseRanking["byPlatform"]) {
  const total = byPlatform.GOOGLE_ADS.spend + byPlatform.META_ADS.spend;
  if (total === 0) return { googlePct: 50, metaPct: 50 };
  return {
    googlePct: (byPlatform.GOOGLE_ADS.spend / total) * 100,
    metaPct: (byPlatform.META_ADS.spend / total) * 100,
  };
}

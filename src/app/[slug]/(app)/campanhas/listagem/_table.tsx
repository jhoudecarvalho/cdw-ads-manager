"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, int, multiplier } from "@/lib/format";
import type { CampaignRow } from "@/server/metrics/campaigns-list";

type SortKey = "revenue" | "spend" | "roas" | "conversions" | "clicks" | "name";
type Dir = "desc" | "asc";

const PAGE_SIZE = 25;

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [dir, setDir] = useState<Dir>("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.franchiseName.toLowerCase().includes(q) ||
            (r.type ?? "").toLowerCase().includes(q),
        )
      : rows;
    const sorted = [...base].sort((a, b) => {
      const av =
        sortKey === "name"
          ? a.name
          : (a as Record<SortKey, number | string>)[sortKey];
      const bv =
        sortKey === "name"
          ? b.name
          : (b as Record<SortKey, number | string>)[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return dir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
    return sorted;
  }, [rows, search, sortKey, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome, franquia ou tipo…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="h-8 max-w-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} de{" "}
          {rows.length.toLocaleString("pt-BR")}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span>Ordenar por:</span>
          <Select
            value={sortKey}
            onValueChange={(v) =>
              typeof v === "string" && setSortKey(v as SortKey)
            }
          >
            <SelectTrigger size="sm" className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Receita</SelectItem>
              <SelectItem value="spend">Investimento</SelectItem>
              <SelectItem value="roas">ROAS</SelectItem>
              <SelectItem value="conversions">Conversões</SelectItem>
              <SelectItem value="clicks">Cliques</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dir}
            onValueChange={(v) => typeof v === "string" && setDir(v as Dir)}
          >
            <SelectTrigger size="sm" className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Maior → menor</SelectItem>
              <SelectItem value="asc">Menor → maior</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Franquia</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Invest.</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhuma campanha encontrada.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.franchiseName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.platform === "GOOGLE_ADS"
                          ? "border-blue-700/40 text-blue-300"
                          : "border-pink-700/40 text-pink-300"
                      }
                    >
                      {r.platform === "GOOGLE_ADS" ? "Google" : "Meta"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.type ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(r.spend)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(r.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {multiplier(r.roas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {int(r.conversions)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Region = { id: string; name: string };
/**
 * Unidade exibida no select — abstrai franquia (modo FRANCHISE) e empresa
 * (modo COMPANY). `regionId` só faz sentido para franquias e é usado para o
 * filtro cascata "ao mudar região, esconde unidades fora dela".
 */
type Unit = { id: string; name: string; regionId: string | null };

type Props = {
  role: "ADMIN" | "REGIONAL" | "FRANCHISEE";
  /** Quando `false`, o select de Região não é renderizado (modo COMPANY). */
  hasRegions: boolean;
  /** Rótulo da unidade no plural ("Franquias" ou "Empresas"). */
  unitLabelPlural: string;
  regions: Region[];
  /** Unidades visíveis ao ator — franquias ou empresas, conforme o tenant. */
  units: Unit[];
};

const ALL = "__all__";

/**
 * Filtros do topo — estilo do design `franchise-ads-dashboard.jsx`:
 * <select> nativos pequenos com background surface-alt e border consistentes.
 * Estado vive na URL — `useTransition` evita flash de loading entre mudanças.
 */
export function FilterBar({
  role,
  hasRegions,
  unitLabelPlural,
  regions,
  units,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const platform = params.get("platform") ?? ALL;
  const regionId = params.get("region") ?? ALL;
  // Mantemos o nome `?franchise=...` no querystring para preservar URLs
  // existentes — semanticamente representa "unidade" (franquia ou empresa).
  const unitId = params.get("franchise") ?? ALL;

  const unitLocked = role === "FRANCHISEE" && units.length === 1;
  const visibleUnits =
    !hasRegions || regionId === ALL
      ? units
      : units.filter((u) => u.regionId === regionId);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    if (key === "region") {
      const u = next.get("franchise");
      if (u && u !== ALL) {
        const stillVisible = units.find(
          (un) => un.id === u && (value === ALL || un.regionId === value),
        );
        if (!stillVisible) next.delete("franchise");
      }
    }
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const selectClass =
    "rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-[11px] text-text cursor-pointer outline-none transition hover:border-border-light focus:border-accent disabled:opacity-50";

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-pending={pending || undefined}
    >
      <select
        value={platform}
        onChange={(e) => updateParam("platform", e.target.value)}
        className={selectClass}
      >
        <option value={ALL}>Todas Plataformas</option>
        <option value="GOOGLE_ADS">Google Ads</option>
        <option value="META_ADS">Meta Ads</option>
      </select>

      {hasRegions && role !== "FRANCHISEE" && regions.length > 0 && (
        <select
          value={regionId}
          onChange={(e) => updateParam("region", e.target.value)}
          className={selectClass}
        >
          <option value={ALL}>Todas Regiões</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}

      {unitLocked ? (
        <div className="rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-[11px] text-text-muted">
          {units[0]!.name}
        </div>
      ) : (
        <select
          value={unitId}
          onChange={(e) => updateParam("franchise", e.target.value)}
          className={selectClass}
          style={{ maxWidth: 240 }}
        >
          <option value={ALL}>{`Todas ${unitLabelPlural}`}</option>
          {visibleUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

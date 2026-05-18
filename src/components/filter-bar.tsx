"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Region = { id: string; name: string };
type Franchise = { id: string; name: string; regionId: string };

type Props = {
  role: "ADMIN" | "REGIONAL" | "FRANCHISEE";
  regions: Region[];
  franchises: Franchise[];
};

const ALL = "__all__";

/**
 * Filtros do topo — estilo do design `franchise-ads-dashboard.jsx`:
 * <select> nativos pequenos com background surface-alt e border consistentes.
 * Estado vive na URL — `useTransition` evita flash de loading entre mudanças.
 */
export function FilterBar({ role, regions, franchises }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const platform = params.get("platform") ?? ALL;
  const regionId = params.get("region") ?? ALL;
  const franchiseId = params.get("franchise") ?? ALL;

  const franchiseLocked = role === "FRANCHISEE" && franchises.length === 1;
  const visibleFranchises =
    regionId === ALL
      ? franchises
      : franchises.filter((f) => f.regionId === regionId);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    if (key === "region") {
      const f = next.get("franchise");
      if (f && f !== ALL) {
        const stillVisible = franchises.find(
          (fr) => fr.id === f && (value === ALL || fr.regionId === value),
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

      {role !== "FRANCHISEE" && regions.length > 0 && (
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

      {franchiseLocked ? (
        <div className="rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-[11px] text-text-muted">
          {franchises[0]!.name}
        </div>
      ) : (
        <select
          value={franchiseId}
          onChange={(e) => updateParam("franchise", e.target.value)}
          className={selectClass}
          style={{ maxWidth: 240 }}
        >
          <option value={ALL}>Todas Franquias</option>
          {visibleFranchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

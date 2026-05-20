"use client";

import { useState } from "react";
import type { UnitOption } from "@/server/ads/accounts";

/**
 * Botão "Conectar via Meta". Navega para o route handler `/api/ads/meta/start`
 * via `window.location` (navegação top-level), **não** via `<form>`.
 *
 * Por quê: a CSP do app tem `form-action 'self'`, e o Chrome valida essa
 * diretiva contra toda a cadeia de redirect de um submit — como o `/start`
 * redireciona pro `facebook.com`, um `<form>` seria bloqueado. Navegação de
 * documento (`window.location`) não é governada por `form-action`, então o
 * fluxo passa sem afrouxar a política.
 */
export function ConnectMetaButton({
  slug,
  units,
  unitLabel,
}: {
  slug: string;
  units: UnitOption[];
  unitLabel: string;
}) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");

  if (units.length === 0) {
    return (
      <p className="text-xs text-text-muted">
        Nenhuma unidade disponível para vincular.
      </p>
    );
  }

  function connect() {
    if (!unitId) return;
    const qs = new URLSearchParams({ slug, unitId });
    window.location.assign(`/api/ads/meta/start?${qs.toString()}`);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          {unitLabel}
        </span>
        <select
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-accent"
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={connect}
        className="w-full rounded-md border border-[#0668E1]/40 bg-[#0668E1]/15 px-4 py-2 text-xs font-semibold text-[#3b82f6] transition hover:bg-[#0668E1]/25"
      >
        Conectar via Meta
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBrandingAction } from "./_actions";

type Props = {
  tenantSlug: string;
  initialLogoUrl: string | null;
  initialPrimaryColor: string | null;
};

export function BrandingForm({
  tenantSlug,
  initialLogoUrl,
  initialPrimaryColor,
}: Props) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    initialPrimaryColor ?? "#7C3AED",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateBrandingAction(tenantSlug, {
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-widest text-text-muted">
          URL da logo
        </label>
        <Input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://exemplo.com/logo.png"
          autoComplete="off"
        />
        <p className="text-[11px] text-text-muted">
          Cole o link público de uma imagem (PNG, JPG, SVG ou WebP). Aparece no
          topo da sidebar.
        </p>
        {logoUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface-alt/40 p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Pré-visualização da logo"
                className="h-12 w-12 object-contain"
                onError={(ev) => {
                  (ev.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="truncate text-xs text-text-muted">{logoUrl}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-widest text-text-muted">
          Cor primária
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor || "#7C3AED"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
          />
          <Input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#7C3AED"
            className="max-w-[140px] font-mono"
          />
        </div>
        <p className="text-[11px] text-text-muted">
          Usada na variável CSS <code>--tenant-primary</code>. Hex no formato
          #RGB ou #RRGGBB.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {savedAt && !error && (
        <p className="text-xs text-emerald-400">
          ✓ Salvo às {savedAt.toLocaleTimeString("pt-BR")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

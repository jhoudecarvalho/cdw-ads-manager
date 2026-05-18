"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Region = { id: string; name: string };
type Franchise = { id: string; name: string; regionId: string };

type Props = {
  role: "ADMIN" | "REGIONAL" | "FRANCHISEE";
  regions: Region[];
  franchises: Franchise[];
};

const ALL = "__all__";

export function FilterBar({ role, regions, franchises }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const platform = params.get("platform") ?? ALL;
  const regionId = params.get("region") ?? ALL;
  const franchiseId = params.get("franchise") ?? ALL;

  // FRANCHISEE com uma única franquia vinculada → mostra estática, sem select.
  const franchiseLocked = role === "FRANCHISEE" && franchises.length === 1;

  // Franquia escolhida limita a região; região escolhida filtra franquias.
  const visibleFranchises =
    regionId === ALL
      ? franchises
      : franchises.filter((f) => f.regionId === regionId);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    // Quando muda a região, limpa franquia se ela sair do escopo.
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
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div
      className="flex flex-1 items-center gap-2"
      data-pending={pending || undefined}
    >
      <Select
        value={platform}
        onValueChange={(v) =>
          updateParam("platform", typeof v === "string" ? v : ALL)
        }
      >
        <SelectTrigger size="sm" className="h-8 w-[140px]">
          <SelectValue placeholder="Plataforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas plataformas</SelectItem>
          <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
          <SelectItem value="META_ADS">Meta Ads</SelectItem>
        </SelectContent>
      </Select>

      {role !== "FRANCHISEE" && regions.length > 0 && (
        <Select
          value={regionId}
          onValueChange={(v) =>
            updateParam("region", typeof v === "string" ? v : ALL)
          }
        >
          <SelectTrigger size="sm" className="h-8 w-[160px]">
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas regiões</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {franchiseLocked ? (
        <div className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
          {franchises[0]!.name}
        </div>
      ) : (
        <Select
          value={franchiseId}
          onValueChange={(v) =>
            updateParam("franchise", typeof v === "string" ? v : ALL)
          }
        >
          <SelectTrigger size="sm" className="h-8 w-[220px]">
            <SelectValue placeholder="Franquia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas franquias</SelectItem>
            {visibleFranchises.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

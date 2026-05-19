"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, PanelLeft } from "lucide-react";
import { signOut } from "next-auth/react";
import type { TenantType } from "@/generated/prisma/client";
import { getTenantModule } from "@/server/tenant/tenant-modules";

/**
 * Sidebar do design Franchise HUB — porte direto de
 * `franchise-ads-dashboard.jsx`. Colapsável (240px ↔ 60px), gradient
 * vertical, logo gradiente cyan→purple com inicial do tenant.
 *
 * Navegação:
 *   - Campanhas Ads (expansível, default aberto): Visão Geral + submenus
 *     condicionais ao `tenantType`:
 *       FRANCHISE: ..., Franquias, Regiões, Performance, Financeiro, Comparativo
 *       COMPANY:   ..., Empresas,           Performance, Financeiro, Comparativo,
 *                  + Cadastrar Empresa
 *   - 4 itens com badge BREVE (Ecocentauro, Indicação, Sellflux, Landing)
 *   - Footer: select de "Nível de acesso" (futuro — hoje só mostra role)
 */

type SubmenuItem = {
  key: string;
  label: string;
  href: string; // path relativo ao slug (vazio = visão geral)
  icon: string;
};

function buildSubmenus(tenantType: TenantType): SubmenuItem[] {
  const mod = getTenantModule(tenantType);
  const items: SubmenuItem[] = [
    { key: "overview", label: "Visão Geral", href: "", icon: "📊" },
    {
      key: "google",
      label: "Google Ads",
      href: "campanhas/google-ads",
      icon: "🔍",
    },
    { key: "meta", label: "Meta Ads", href: "campanhas/meta-ads", icon: "📱" },
    {
      key: "campaigns",
      label: "Campanhas",
      href: "campanhas/listagem",
      icon: "📋",
    },
  ];

  if (tenantType === "FRANCHISE") {
    items.push({
      key: "franchises",
      label: mod.unitLabelPlural,
      href: "campanhas/franquias",
      icon: "🏪",
    });
  } else {
    items.push({
      key: "companies",
      label: mod.unitLabelPlural,
      href: "campanhas/empresas",
      icon: "🏢",
    });
  }

  if (mod.hasRegions) {
    items.push({
      key: "regions",
      label: "Regiões",
      href: "campanhas/regioes",
      icon: "🗺️",
    });
  }

  items.push(
    {
      key: "performance",
      label: "Performance",
      href: "campanhas/performance",
      icon: "⚡",
    },
    {
      key: "financial",
      label: "Financeiro",
      href: "campanhas/financeiro",
      icon: "💰",
    },
    {
      key: "comparison",
      label: "Comparativo",
      href: "campanhas/comparativo",
      icon: "⚖️",
    },
  );

  if (mod.canRegisterUnits) {
    items.push({
      key: "company-register",
      label: "Cadastrar Empresa",
      href: "campanhas/empresas/cadastrar",
      icon: "➕",
    });
  }

  return items;
}

const COMING_SOON = [
  {
    key: "ecocentauro",
    label: "Dados Ecocentauro",
    href: "ecocentauro",
    icon: "🦎",
  },
  {
    key: "indicacao",
    label: "Programa Indicação",
    href: "indicacao",
    icon: "🤝",
  },
  { key: "sellflux", label: "Sellflux", href: "sellflux", icon: "🔄" },
  {
    key: "landingpage",
    label: "Landing Page",
    href: "landing-page",
    icon: "🌐",
  },
];

type Props = {
  tenantSlug: string;
  tenantName: string;
  tenantType: TenantType;
  tenantLogoUrl: string | null;
  userEmail: string;
  userName: string | null;
  userRole: string;
};

const ROLE_META: Record<string, { label: string; icon: string }> = {
  ADMIN: { label: "Administrador (Matriz)", icon: "👑" },
  REGIONAL: { label: "Gestor Regional", icon: "🗺️" },
  FRANCHISEE: { label: "Franqueado", icon: "🏪" },
};

export function AppSidebar({
  tenantSlug,
  tenantName,
  tenantType,
  tenantLogoUrl,
  userEmail,
  userName,
  userRole,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [adsOpen, setAdsOpen] = useState(true);

  const submenus = buildSubmenus(tenantType);

  const hrefFor = (rel: string) =>
    rel === "" ? `/${tenantSlug}` : `/${tenantSlug}/${rel}`;
  const isActive = (rel: string) => {
    const full = hrefFor(rel);
    if (rel === "") return pathname === full;
    return pathname === full || pathname.startsWith(full + "/");
  };

  const adsActive = submenus.some((s) => isActive(s.href));

  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden border-r border-border transition-[width] duration-300"
      style={{
        width: open ? 240 : 60,
        minHeight: "100vh",
        background: "linear-gradient(180deg, var(--surface) 0%, #0d1220 100%)",
      }}
    >
      {/* Logo + toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 border-b border-border px-4 py-5 transition hover:bg-surface-alt/30"
        style={{ paddingInline: open ? 16 : 8 }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-[18px] font-extrabold text-bg"
          style={
            tenantLogoUrl
              ? { background: "var(--surface-alt, #0d1220)" }
              : {
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-alt))",
                }
          }
        >
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-full w-full object-contain"
            />
          ) : (
            tenantName.slice(0, 1).toUpperCase()
          )}
        </div>
        {open && (
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-extrabold leading-tight text-text">
              {tenantName}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-text-muted">
              Painel Integrado
            </div>
          </div>
        )}
        {open && <PanelLeft className="h-3.5 w-3.5 text-text-muted" />}
      </button>

      {/* Menu */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: open ? "12px 8px" : "12px 4px" }}
      >
        {/* Campanhas Ads — expansível */}
        <button
          onClick={() => setAdsOpen(!adsOpen)}
          className="flex w-full items-center gap-2.5 rounded-lg text-[12px] font-bold text-accent transition-colors hover:bg-accent/10"
          style={{
            padding: open ? "10px 12px" : "10px 0",
            justifyContent: open ? "flex-start" : "center",
            background: adsOpen ? "rgba(34, 211, 238, 0.07)" : "transparent",
          }}
        >
          <span className="text-base">📣</span>
          {open && (
            <>
              <span className="flex-1 text-left">Campanhas Ads</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${adsOpen ? "rotate-180" : ""}`}
              />
            </>
          )}
        </button>

        {/* Submenus */}
        {adsOpen && (
          <div
            className="mt-1"
            style={{ paddingLeft: open ? 12 : 0, marginBottom: 8 }}
          >
            {submenus.map((s) => {
              const active = isActive(s.href);
              return (
                <Link
                  key={s.key}
                  href={hrefFor(s.href)}
                  className="my-px flex w-full items-center gap-2.5 rounded-lg text-[11px] transition-colors"
                  style={{
                    padding: open ? "8px 12px" : "8px 0",
                    justifyContent: open ? "flex-start" : "center",
                    background: active
                      ? "rgba(34, 211, 238, 0.10)"
                      : "transparent",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: active ? 700 : 500,
                    borderLeft: active
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                  }}
                  title={!open ? s.label : undefined}
                >
                  <span className="text-[13px]">{s.icon}</span>
                  {open && s.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Separator */}
        <div className="my-2 h-px bg-border" />

        {/* BREVE items */}
        {COMING_SOON.map((c) => {
          const active = isActive(c.href);
          return (
            <Link
              key={c.key}
              href={hrefFor(c.href)}
              className="my-0.5 flex w-full items-center gap-2.5 rounded-lg text-[12px] font-semibold opacity-70 transition-colors hover:opacity-100"
              style={{
                padding: open ? "10px 12px" : "10px 0",
                justifyContent: open ? "flex-start" : "center",
                background: active
                  ? "rgba(167, 139, 250, 0.10)"
                  : "transparent",
                color: active ? "var(--accent-alt)" : "var(--text-muted)",
              }}
              title={!open ? c.label : undefined}
            >
              <span className="text-base">{c.icon}</span>
              {open && (
                <>
                  <span className="flex-1 text-left">{c.label}</span>
                  <span
                    className="rounded text-[8px] font-extrabold uppercase tracking-wider"
                    style={{
                      padding: "2px 6px",
                      background: "rgba(251, 191, 36, 0.15)",
                      color: "var(--warning)",
                    }}
                  >
                    BREVE
                  </span>
                </>
              )}
            </Link>
          );
        })}

        {adsActive && false /* keep adsActive referenced for lint */}

        {/* Settings — só ADMIN */}
        {userRole === "ADMIN" && (
          <>
            <div className="my-2 h-px bg-border" />
            <Link
              href={hrefFor("settings")}
              className="my-0.5 flex w-full items-center gap-2.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                padding: open ? "10px 12px" : "10px 0",
                justifyContent: open ? "flex-start" : "center",
                background: isActive("settings")
                  ? "rgba(167, 139, 250, 0.10)"
                  : "transparent",
                color: isActive("settings")
                  ? "var(--accent-alt)"
                  : "var(--text-muted)",
              }}
              title={!open ? "Configurações" : undefined}
            >
              <span className="text-base">⚙️</span>
              {open && <span className="flex-1 text-left">Configurações</span>}
            </Link>
          </>
        )}
      </nav>

      {/* Footer — usuário + role + sair */}
      {open && (
        <div className="border-t border-border px-3.5 py-3 text-[11px]">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[1.2px] text-text-muted">
            Nível de Acesso
          </div>
          <div className="mb-2 rounded-md border border-border bg-surface-alt px-2 py-1.5 text-[11px]">
            <div className="text-text">
              {ROLE_META[userRole]?.icon ?? "👤"}{" "}
              {ROLE_META[userRole]?.label ?? userRole}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="truncate text-[10px] text-text">
              {userName ?? userEmail}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
              className="text-[10px] text-text-muted underline-offset-2 transition hover:text-accent hover:underline"
            >
              Sair
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

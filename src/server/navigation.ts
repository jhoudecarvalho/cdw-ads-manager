/**
 * Estrutura de navegação do tenant — fonte única de verdade para a sidebar
 * e para gerar as rotas correspondentes (futuro: validação de existência das
 * páginas).
 *
 * `comingSoon: true` deixa o item visualmente desabilitado e com badge
 * "BREVE" — usado nos 4 módulos planejados mas ainda sem implementação.
 */

export type NavLink = {
  /** Path relativo ao slug do tenant. Ex.: "" → /{slug}; "campanhas/google-ads" → /{slug}/campanhas/google-ads */
  href: string;
  label: string;
  icon?: string;
  comingSoon?: boolean;
};

export type NavGroup = {
  label: string;
  icon: string;
  items: NavLink[];
};

export type NavSection = NavGroup | NavLink;

export const NAVIGATION: NavSection[] = [
  {
    label: "Campanhas Ads",
    icon: "Megaphone",
    items: [
      { href: "", label: "Visão Geral", icon: "LayoutDashboard" },
      { href: "campanhas/google-ads", label: "Google Ads", icon: "Search" },
      { href: "campanhas/meta-ads", label: "Meta Ads", icon: "MessageCircle" },
      { href: "campanhas/listagem", label: "Campanhas", icon: "List" },
      { href: "campanhas/franquias", label: "Franquias", icon: "Store" },
      { href: "campanhas/regioes", label: "Regiões", icon: "Map" },
      {
        href: "campanhas/performance",
        label: "Performance",
        icon: "TrendingUp",
      },
      { href: "campanhas/financeiro", label: "Financeiro", icon: "DollarSign" },
      {
        href: "campanhas/comparativo",
        label: "Comparativo",
        icon: "GitCompareArrows",
      },
    ],
  },
  {
    href: "ecocentauro",
    label: "Dados Ecocentauro",
    icon: "Sprout",
    comingSoon: true,
  },
  {
    href: "indicacao",
    label: "Programa Indicação",
    icon: "Handshake",
    comingSoon: true,
  },
  { href: "sellflux", label: "Sellflux", icon: "RefreshCw", comingSoon: true },
  {
    href: "landing-page",
    label: "Landing Page",
    icon: "Globe",
    comingSoon: true,
  },
];

export function isNavGroup(s: NavSection): s is NavGroup {
  return "items" in s;
}

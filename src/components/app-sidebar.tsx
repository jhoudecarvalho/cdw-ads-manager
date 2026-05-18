"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DollarSign,
  GitCompareArrows,
  Globe,
  Handshake,
  LayoutDashboard,
  List,
  Map,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Search,
  Sprout,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAVIGATION, isNavGroup, type NavLink } from "@/server/navigation";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Megaphone,
  Search,
  MessageCircle,
  List,
  Store,
  Map,
  TrendingUp,
  DollarSign,
  GitCompareArrows,
  Sprout,
  Handshake,
  RefreshCw,
  Globe,
};

type Props = {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  userEmail: string;
  userName: string | null;
  userRole: string;
};

export function AppSidebar(props: Props) {
  const {
    tenantSlug,
    tenantName,
    tenantLogoUrl,
    userEmail,
    userName,
    userRole,
  } = props;
  const pathname = usePathname();

  const hrefFor = (href: string) =>
    href === "" ? `/${tenantSlug}` : `/${tenantSlug}/${href}`;

  const isActive = (href: string) => {
    const full = hrefFor(href);
    if (href === "") return pathname === full;
    return pathname === full || pathname.startsWith(full + "/");
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          {tenantLogoUrl ? (
            // Logo dinâmico do tenant.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-8 w-8 rounded object-contain"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
              style={{ backgroundColor: "var(--tenant-primary, #7C3AED)" }}
            >
              {tenantName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">{tenantName}</span>
            <span className="truncate text-xs text-muted-foreground">
              /{tenantSlug}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAVIGATION.map((section, idx) =>
          isNavGroup(section) ? (
            <SidebarGroup key={idx}>
              <SidebarGroupLabel className="flex items-center gap-2">
                {renderIcon(section.icon, "size-4")}
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <NavItem
                      key={item.href}
                      item={item}
                      href={hrefFor(item.href)}
                      active={isActive(item.href)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <SidebarGroup key={idx}>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem
                    item={section}
                    href={hrefFor(section.href)}
                    active={isActive(section.href)}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ),
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {(userName ?? userEmail).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs font-medium">
              {userName ?? userEmail}
            </span>
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {userRole}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs group-data-[collapsible=icon]:hidden"
            onClick={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
          >
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavItem({
  item,
  href,
  active,
}: {
  item: NavLink;
  href: string;
  active: boolean;
}) {
  if (item.comingSoon) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href={href} className="opacity-60" />}
          tooltip={item.label}
        >
          {renderIcon(item.icon, "size-4")}
          <span className="flex-1">{item.label}</span>
          <Badge variant="secondary" className="text-[9px] uppercase">
            BREVE
          </Badge>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={href} />}
        tooltip={item.label}
        isActive={active}
      >
        {renderIcon(item.icon, "size-4")}
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function renderIcon(name: string | undefined, className: string) {
  if (!name) return null;
  const Icon = ICONS[name];
  return Icon ? <Icon className={className} /> : null;
}

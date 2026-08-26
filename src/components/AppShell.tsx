import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  Building2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Megaphone,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Users,
  FileText,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useStore, type PermissionKey } from "@/lib/store";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey | PermissionKey[];
  ownerOnly?: boolean;
  primaryMobile?: boolean;
};

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
    primaryMobile: true,
  },
  {
    to: "/leads",
    label: "CRM / Leads",
    icon: UserRound,
    permission: "leadsView",
    primaryMobile: true,
  },
  {
    to: "/inbox",
    label: "WhatsApp Inbox",
    icon: MessageSquare,
    permission: ["inboxReply", "inboxAssign"],
    primaryMobile: true,
  },
  {
    to: "/templates",
    label: "Templates",
    icon: FileText,
    permission: ["templatesUse", "templatesManage"],
    primaryMobile: true,
  },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, permission: "campaigns" },
  { to: "/automations", label: "Automations", icon: Bot, permission: "automations" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics" },
  { to: "/team", label: "Team", icon: Users, ownerOnly: true },
  { to: "/permissions", label: "Permissions", icon: ShieldCheck, ownerOnly: true },
  { to: "/settings", label: "Settings", icon: Settings, permission: "settings" },
];

function useVisibleNav() {
  const { isOwner, can } = useStore();
  return NAV.filter((item) => {
    if (item.ownerOnly) return isOwner;
    if (!item.permission) return true;
    const keys = Array.isArray(item.permission) ? item.permission : [item.permission];
    return keys.some((k) => can(k));
  });
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const items = useVisibleNav();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          activeProps={{ "data-status": "active" }}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function AccountBlock({ onNavigate }: { onNavigate?: () => void }) {
  const { isOwner, currentMember, state, signOut } = useStore();
  const router = useRouter();

  return (
    <div className="border-t border-white/10 pt-3">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
          {(isOwner ? state.settings.ownerName || "O" : currentMember?.name || "M")
            .slice(0, 1)
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {isOwner ? state.settings.ownerName || "Workspace owner" : currentMember?.name}
          </p>
          <p className="truncate text-xs text-white/60">{isOwner ? "Owner" : "Member"}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          signOut();
          void router.navigate({ to: "/" });
        }}
        className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isOwner, currentMember, state } = useStore();
  const items = useVisibleNav();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const primary = items.filter((i) => i.primaryMobile).slice(0, 4);
  const overflow = items.filter((i) => !primary.includes(i));

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy px-3 py-4 lg:flex">
        <div className="px-2 pb-4">
          <Logo onDark />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <AccountBlock />
      </aside>

      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-white px-4 lg:h-16 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <MoreHorizontal className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[17rem] border-none bg-navy p-3">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="px-2 pt-1 pb-4">
                  <Logo onDark />
                </div>
                <NavList onNavigate={() => setMenuOpen(false)} />
                <div className="mt-4">
                  <AccountBlock onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 lg:hidden">
              <Logo className="h-6" />
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
              <Building2 className="size-4" aria-hidden="true" />
              <span className="truncate font-medium text-foreground">
                {state.settings.workspaceName}
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-navy">
            {isOwner ? "Owner" : `Member${currentMember ? ` · ${currentMember.name}` : ""}`}
          </span>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-24 lg:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-white pt-1.5 lg:hidden"
        aria-label="Primary"
      >
        {primary.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
        {overflow.length > 0 ? (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            More
          </button>
        ) : null}
      </nav>
    </div>
  );
}

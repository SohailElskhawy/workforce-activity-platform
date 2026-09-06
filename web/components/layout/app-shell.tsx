"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  Clock3,
  FolderKanban,
  Gauge,
  Laptop,
  ListChecks,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useI18n } from "@/lib/i18n";

type AppRole = "MANAGER" | "EMPLOYEE";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavigationGroup = {
  heading?: string;
  items: NavigationItem[];
};

export function AppShell({
  children,
  email,
  role,
}: {
  children?: React.ReactNode;
  email: string | null | undefined;
  role: AppRole;
}) {
  const { t } = useI18n();
  const pathname = usePathname() ?? "";
  const isManager = role === "MANAGER";

  const managerGroups: NavigationGroup[] = [
    {
      items: [
        { href: "/dashboard", icon: Gauge, label: t.common.navigation.dashboard },
      ],
    },
    {
      heading: t.common.navigation.workforce,
      items: [
        { href: "/employees", icon: Users, label: t.common.navigation.employees },
        { href: "/departments", icon: Building2, label: t.common.navigation.departments },
        { href: "/devices", icon: Laptop, label: t.common.navigation.devices },
      ],
    },
    {
      heading: t.common.navigation.work,
      items: [
        { href: "/projects", icon: FolderKanban, label: t.common.navigation.projects },
        { href: "/tasks", icon: ListChecks, label: t.common.navigation.tasks },
      ],
    },
    {
      heading: t.common.navigation.tracking,
      items: [
        { href: "/activities", icon: Activity, label: t.common.navigation.activities },
        { href: "/time-entries", icon: Clock3, label: t.common.navigation.timeEntries },
      ],
    },
    {
      heading: t.common.navigation.analytics,
      items: [
        { href: "/reports", icon: BarChart3, label: t.common.navigation.reports },
      ],
    },
    {
      heading: t.common.navigation.administration,
      items: [
        { href: "/settings", icon: Settings, label: t.common.navigation.settings },
      ],
    },
  ];

  const employeeGroups: NavigationGroup[] = [
    {
      items: [
        { href: "/my-dashboard", icon: Gauge, label: t.common.navigation.overview },
        { href: "/my-tasks", icon: ListChecks, label: t.common.navigation.myTasks },
        { href: "/my-projects", icon: BriefcaseBusiness, label: t.common.navigation.myProjects },
        { href: "/my-time", icon: Clock3, label: t.common.navigation.manualTime },
        { href: "/my-activity", icon: Activity, label: t.common.navigation.myActivity },
      ],
    },
  ];

  const groups = isManager ? managerGroups : employeeGroups;
  const workspaceTitle = isManager ? t.common.managerWorkspace : t.common.employeeWorkspace;
  const navAriaLabel = isManager ? t.common.navigation.managerNavigation : t.common.navigation.employeeNavigation;
  const accountLabel = isManager ? t.common.managerAccount : t.common.employeeAccount;
  const homeHref = isManager ? "/dashboard" : "/my-dashboard";
  const safeEmail = email ?? t.common.signedInUser;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <Brand href={homeHref} tagline={t.common.brandTagline} />
        <div className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {workspaceTitle}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
          <Navigation currentPath={pathname} groups={groups} label={navAriaLabel} />
        </div>
        <div className="mt-auto space-y-4 border-t border-slate-800 p-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
              {t.common.workspaceConnected}
            </div>
            <p className="truncate text-sm font-medium text-white">
              {safeEmail}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{accountLabel}</p>
          </div>
          <LogoutButton className="w-full justify-start border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white" />
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
          <div className="lg:hidden">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg text-sm font-semibold text-slate-900 marker:content-none">
                <span className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Menu className="size-4" />
                </span>
                <span>WorkLens</span>
              </summary>
              <div className="absolute left-0 top-12 max-h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15">
                <Navigation
                  currentPath={pathname}
                  groups={groups}
                  label={navAriaLabel}
                  mobile
                />
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-2 pt-3">
                  <LanguageSwitcher />
                </div>
                <div className="mt-2 border-t border-slate-100 px-2 pt-2">
                  <p className="truncate px-2 pb-2 text-xs text-slate-500">
                    {safeEmail}
                  </p>
                  <LogoutButton className="w-full justify-start" />
                </div>
              </div>
            </details>
          </div>

          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900">
              {t.common.operationalWorkspace}
            </p>
            <p className="text-xs text-slate-500">
              {t.common.operationalWorkspaceDesc}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-label={t.common.notifications}
              className="relative inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              type="button"
            >
              <Bell className="size-4" />
            </button>
            <LanguageSwitcher />
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t.common.liveData}
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {safeEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function Brand({ href, tagline }: { href: string; tagline: string }) {
  return (
    <Link
      className="flex h-20 items-center gap-3 border-b border-slate-800 px-6"
      href={href}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20">
        <ShieldCheck className="size-5" />
      </span>
      <span>
        <span className="block text-lg font-semibold tracking-tight text-white">
          WorkLens
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
          {tagline}
        </span>
      </span>
    </Link>
  );
}

function isItemActive(pathname: string, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard" || href === "/my-dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({
  currentPath,
  groups,
  label,
  mobile = false,
}: {
  currentPath: string;
  groups: NavigationGroup[];
  label: string;
  mobile?: boolean;
}) {
  return (
    <nav aria-label={label} className={mobile ? "space-y-4" : "space-y-4 px-2"}>
      {groups.map((group, groupIndex) => (
        <div className="space-y-1" key={group.heading ?? `group-${groupIndex}`}>
          {group.heading ? (
            <div
              className={
                mobile
                  ? "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                  : "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              }
            >
              {group.heading}
            </div>
          ) : null}
          {group.items.map(({ href, icon: Icon, label: itemLabel }) => {
            const active = isItemActive(currentPath, href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  mobile
                    ? active
                      ? "flex items-center gap-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-950"
                      : "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                    : active
                      ? "flex items-center gap-3 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                      : "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900/80 hover:text-slate-200"
                }
                href={href}
                key={href}
              >
                <Icon className={active ? "size-4 text-emerald-400" : "size-4"} />
                {itemLabel}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}



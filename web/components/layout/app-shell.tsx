import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  FolderKanban,
  Gauge,
  ListChecks,
  Menu,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";

type AppRole = "MANAGER" | "EMPLOYEE";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const managerNavigation: NavigationItem[] = [
  { href: "/dashboard", icon: Gauge, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/employees", icon: Users, label: "Employees" },
  { href: "/activities", icon: Activity, label: "Activity" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
];

const employeeNavigation: NavigationItem[] = [
  { href: "/my-dashboard", icon: Gauge, label: "Overview" },
  { href: "/my-projects", icon: BriefcaseBusiness, label: "My projects" },
  { href: "/my-tasks", icon: ListChecks, label: "My tasks" },
  { href: "/my-time", icon: Clock3, label: "Manual time" },
  { href: "/my-activity", icon: Activity, label: "My activity" },
];

export function AppShell({
  children,
  email,
  role,
}: {
  children?: React.ReactNode;
  email: string | null | undefined;
  role: AppRole;
}) {
  const isManager = role === "MANAGER";
  const navigation = isManager ? managerNavigation : employeeNavigation;
  const roleLabel = isManager ? "Manager" : "Employee";
  const homeHref = isManager ? "/dashboard" : "/my-dashboard";
  const safeEmail = email ?? "Signed-in user";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <Brand href={homeHref} />
        <div className="px-5 pb-3 pt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {roleLabel} workspace
        </div>
        <Navigation items={navigation} label={`${roleLabel} navigation`} />
        <div className="mt-auto space-y-4 border-t border-slate-800 p-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
              Workspace connected
            </div>
            <p className="truncate text-sm font-medium text-white">
              {safeEmail}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{roleLabel} account</p>
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
              <div className="absolute left-0 top-12 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15">
                <Navigation
                  items={navigation}
                  label={`${roleLabel} navigation`}
                  mobile
                />
                <div className="mt-3 border-t border-slate-100 px-2 pt-3">
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
              Operational workspace
            </p>
            <p className="text-xs text-slate-500">
              Projects, people, and activity in one place
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Live data
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

function Brand({ href }: { href: string }) {
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
          Workforce intelligence
        </span>
      </span>
    </Link>
  );
}

function Navigation({
  items,
  label,
  mobile = false,
}: {
  items: NavigationItem[];
  label: string;
  mobile?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className={mobile ? "space-y-1" : "space-y-1 px-4"}
    >
      {items.map(({ href, icon: Icon, label: itemLabel }) => (
        <Link
          className={
            mobile
              ? "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
              : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          }
          href={href}
          key={href}
        >
          <Icon className="size-4" />
          {itemLabel}
        </Link>
      ))}
    </nav>
  );
}

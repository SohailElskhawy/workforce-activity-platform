import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  ListChecks,
  Users,
  Wifi,
} from "lucide-react";
import Link from "next/link";

import { PriorityBadge } from "@/components/manager/priority-badge";
import { StatusBadge } from "@/components/manager/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDate,
  formatDurationFromSeconds,
} from "@/lib/formatters";

type DashboardMetrics = {
  activeSeconds: number;
  employeeCount: number;
  idleSeconds: number;
  onlineDeviceCount: number;
  overdueTaskCount: number;
  weekActiveSeconds: number;
};

type DashboardProject = {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  status: string;
  endDate: Date | null;
  estimatedHours: number | null;
  taskCount: number;
};

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: Date | null;
  projectCode: string;
  assignees: string[];
};

type DashboardActivity = {
  id: string;
  type: string;
  applicationName: string | null;
  fileName: string | null;
  durationSeconds: number;
  startAt: Date;
  employeeId: string;
  employeeName: string;
  projectCode: string | null;
  taskTitle: string | null;
};

export function ManagerDashboard({
  metrics,
  projects,
  recentActivities,
  tasks,
}: {
  metrics: DashboardMetrics;
  projects: DashboardProject[];
  recentActivities: DashboardActivity[];
  tasks: DashboardTask[];
}) {
  const activeProjectCount = projects.filter(
    ({ status }) => status === "ACTIVE",
  ).length;
  const openTaskCount = tasks.filter(
    ({ status }) => status !== "COMPLETED" && status !== "CANCELLED",
  ).length;
  const cards = [
    {
      label: "Team members",
      value: String(metrics.employeeCount),
      detail: `${metrics.onlineDeviceCount} agent${metrics.onlineDeviceCount === 1 ? "" : "s"} online`,
      icon: Users,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Active projects",
      value: String(activeProjectCount),
      detail: `${projects.length} projects in portfolio`,
      icon: BriefcaseBusiness,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Open tasks",
      value: String(openTaskCount),
      detail: `${metrics.overdueTaskCount} overdue`,
      icon: ListChecks,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "7-day activity",
      value: formatDurationFromSeconds(metrics.weekActiveSeconds),
      detail: "Foreground application time",
      icon: Activity,
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <main className="flex-1 space-y-8 p-5 sm:p-7 lg:p-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Company overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Manager Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            A clear view of delivery, workload, and recent employee activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            href="/reports"
          >
            View reports
          </Link>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
            href="/projects"
          >
            Open projects <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ detail, icon: Icon, label, tone, value }) => (
          <Card className="border-slate-200 shadow-sm" key={label}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardDescription className="font-medium text-slate-500">
                  {label}
                </CardDescription>
                <CardTitle className="mt-2 text-3xl tracking-tight text-slate-950">
                  {value}
                </CardTitle>
              </div>
              <span
                className={`flex size-10 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon className="size-5" />
              </span>
            </CardHeader>
            <CardContent className="text-xs text-slate-500">
              {detail}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Portfolio overview</CardTitle>
              <CardDescription>
                Current projects, task volume, and delivery dates.
              </CardDescription>
            </div>
            <Link
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
              href="/projects"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.slice(0, 4).map((project) => (
              <Link
                className="group flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700">
                      {project.code}
                    </span>
                    <StatusBadge value={project.status} />
                  </div>
                  <p className="mt-1 truncate font-semibold text-slate-900 group-hover:text-slate-950">
                    {project.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {project.clientName ?? "Internal project"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6 text-sm sm:text-right">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {project.taskCount}
                    </p>
                    <p className="text-xs text-slate-500">Tasks</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatDate(project.endDate)}
                    </p>
                    <p className="text-xs text-slate-500">Target</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Priority work</CardTitle>
            <CardDescription>
              Upcoming and high-priority work requiring attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.slice(0, 5).map((task) => (
              <Link
                className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                href={`/tasks/${task.id}`}
                key={task.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 hover:underline">
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {task.projectCode} ·{" "}
                    {task.assignees.join(", ") || "Unassigned"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Due {formatDate(task.dueDate)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <PriorityBadge value={task.priority} />
                  <StatusBadge value={task.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Latest captured work across the company.
              </CardDescription>
            </div>
            <Link
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
              href="/activities"
            >
              Explore activity
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {recentActivities.map((activity) => (
              <div
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                key={activity.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    {activity.type === "IDLE" ? (
                      <Clock3 className="size-5" />
                    ) : (
                      <Activity className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <Link
                      className="text-sm font-semibold text-slate-900 hover:underline"
                      href={`/employees/${activity.employeeId}`}
                    >
                      {activity.employeeName}
                    </Link>
                    <p className="truncate text-sm text-slate-600">
                      {activity.type === "IDLE"
                        ? "Idle period"
                        : activity.applicationName ?? activity.type}
                      {activity.fileName ? ` · ${activity.fileName}` : ""}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {activity.projectCode ?? "Unmapped activity"}
                      {activity.taskTitle ? ` · ${activity.taskTitle}` : ""}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDurationFromSeconds(activity.durationSeconds)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(activity.startAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-950 text-white shadow-sm">
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
              <Wifi className="size-5" />
            </div>
            <CardTitle className="text-white">Today&apos;s signal</CardTitle>
            <CardDescription className="text-slate-400">
              Live activity updates as agents report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Signal
              label="Active"
              value={formatDurationFromSeconds(metrics.activeSeconds)}
            />
            <Signal
              label="Idle"
              value={formatDurationFromSeconds(metrics.idleSeconds)}
            />
            <Signal
              label="Agents online"
              value={String(metrics.onlineDeviceCount)}
            />
            <Link
              className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-emerald-300 hover:text-emerald-200"
              href="/activities"
            >
              View live activity <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}


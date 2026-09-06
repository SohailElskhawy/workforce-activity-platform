import Link from "next/link";
import { Activity, CheckSquare, Clock3, ListChecks } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import {
  formatDate,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getEmployeeDashboard } from "@/lib/services/employee-self";

export default async function MyDashboardPage() {
  const [session, locale] = await Promise.all([
    requireEmployee(),
    getServerLocale(),
  ]);
  const [dashboard, t] = await Promise.all([
    getEmployeeDashboard(toAuthContext(session)),
    getServerDictionary(locale),
  ]);
  const cards = [
    {
      label: t.employeeDashboard.todaysManualTime,
      value: formatDurationFromMinutes(dashboard.manualMinutes, locale),
      icon: Clock3,
      tone: "sky" as const,
    },
    {
      label: t.employeeDashboard.assignedTasks,
      value: dashboard.assignedTaskCount,
      icon: ListChecks,
      tone: "amber" as const,
    },
    {
      label: t.employeeDashboard.inProgress,
      value: dashboard.inProgressTaskCount,
      icon: CheckSquare,
      tone: "violet" as const,
    },
    {
      label: t.employeeDashboard.todaysActivity,
      value: formatDurationFromSeconds(dashboard.activeSeconds, locale),
      icon: Activity,
      tone: "emerald" as const,
    },
  ];

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeader
        description={t.employeeDashboard.subtitle}
        title={t.employeeDashboard.title}
      />
      <KpiGrid>
        {cards.map(({ icon, label, tone, value }) => (
          <KpiCard
            icon={icon}
            key={label}
            label={label}
            tone={tone}
            value={value}
          />
        ))}
      </KpiGrid>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.employeeDashboard.recentTasks}</CardTitle>
            <CardDescription>{t.employeeDashboard.recentTasksDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.recentTasks.length ? (
              <div className="space-y-3">
                {dashboard.recentTasks.map((task) => (
                  <div
                    className="flex items-center justify-between gap-4"
                    key={task.id}
                  >
                    <div>
                      <Link
                        className="font-medium hover:underline"
                        href="/my-tasks"
                      >
                        {task.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {task.project.code} · {t.managerDashboard.due} {formatDate(task.dueDate, locale)}
                      </p>
                    </div>
                    <StatusBadge value={task.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                description={t.employeeDashboard.noAssignedTasksDesc}
                title={t.employeeDashboard.noAssignedTasks}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.employeeDashboard.activityToday}</CardTitle>
            <CardDescription>
              {t.employeeDashboard.activityTodayDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t.employeeDashboard.activeAppTime}
              </span>
              <span className="font-medium">
                {formatDurationFromSeconds(dashboard.activeSeconds, locale)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.employeeDashboard.idleTime}</span>
              <span className="font-medium">
                {formatDurationFromSeconds(dashboard.idleSeconds, locale)}
              </span>
            </div>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/my-activity"
            >
              {t.employeeDashboard.viewActivity}
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}


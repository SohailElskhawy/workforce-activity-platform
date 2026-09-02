import Link from "next/link";
import { Activity, CheckSquare, Clock3, ListChecks } from "lucide-react";

import { StatusBadge } from "@/components/manager/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    },
    {
      label: t.employeeDashboard.assignedTasks,
      value: dashboard.assignedTaskCount,
      icon: ListChecks,
    },
    {
      label: t.employeeDashboard.inProgress,
      value: dashboard.inProgressTaskCount,
      icon: CheckSquare,
    },
    {
      label: t.employeeDashboard.todaysActivity,
      value: formatDurationFromSeconds(dashboard.activeSeconds, locale),
      icon: Activity,
    },
  ];

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.employeeDashboard.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.employeeDashboard.subtitle}
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
              </div>
              <Icon className="size-5 text-muted-foreground" />
            </CardHeader>
          </Card>
        ))}
      </section>
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


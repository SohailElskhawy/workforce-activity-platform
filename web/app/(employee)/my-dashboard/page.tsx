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
import { getEmployeeDashboard } from "@/lib/services/employee-self";

export default async function MyDashboardPage() {
  const session = await requireEmployee();
  const dashboard = await getEmployeeDashboard(toAuthContext(session));
  const cards = [
    {
      label: "Today's manual time",
      value: formatDurationFromMinutes(dashboard.manualMinutes),
      icon: Clock3,
    },
    {
      label: "Assigned tasks",
      value: dashboard.assignedTaskCount,
      icon: ListChecks,
    },
    {
      label: "In progress",
      value: dashboard.inProgressTaskCount,
      icon: CheckSquare,
    },
    {
      label: "Today's activity",
      value: formatDurationFromSeconds(dashboard.activeSeconds),
      icon: Activity,
    },
  ];

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your assignments, reported time, and recent activity.
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
            <CardTitle>Recent tasks</CardTitle>
            <CardDescription>Your most recently assigned work.</CardDescription>
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
                        {task.project.code} · Due {formatDate(task.dueDate)}
                      </p>
                    </div>
                    <StatusBadge value={task.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Tasks will appear here when a manager assigns you work."
                title="No assigned tasks yet."
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activity today</CardTitle>
            <CardDescription>
              Automatically captured computer activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Active application time
              </span>
              <span className="font-medium">
                {formatDurationFromSeconds(dashboard.activeSeconds)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Idle time</span>
              <span className="font-medium">
                {formatDurationFromSeconds(dashboard.idleSeconds)}
              </span>
            </div>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/my-activity"
            >
              View activity
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

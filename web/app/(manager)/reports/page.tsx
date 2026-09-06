import { ReportTabs } from "@/components/activity/report-tabs";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { formatDurationFromSeconds } from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getManagerDashboardMetrics } from "@/lib/services/dashboard";
import { listEmployees } from "@/lib/services/employees";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";

export default async function ReportsPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const [metrics, employees, projects, tasks, t] = await Promise.all([
    getManagerDashboardMetrics(context),
    listEmployees(context),
    listProjects(context),
    listTasks(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeader
        description={t.reports.subtitle}
        title={t.reports.title}
      />
      <KpiGrid>
        <KpiCard
          label={t.employees.title}
          tone="sky"
          value={String(metrics.employeeCount)}
        />
        <KpiCard
          label={t.employees.activeTimeToday}
          tone="emerald"
          value={formatDurationFromSeconds(metrics.activeSeconds, locale)}
        />
        <KpiCard
          label={t.employees.idleTimeToday}
          tone="amber"
          value={formatDurationFromSeconds(metrics.idleSeconds, locale)}
        />
        <KpiCard
          label={t.managerDashboard.openTasks}
          tone="violet"
          value={String(metrics.overdueTaskCount)}
        />
      </KpiGrid>
      <Card>
        <CardHeader>
          <CardTitle>{t.reports.title}</CardTitle>
          <CardDescription>
            {t.reports.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTabs
            employees={employees.map(({ firstName, id, lastName }) => ({
              firstName,
              id,
              lastName,
            }))}
            projects={projects.map(({ code, id, name }) => ({
              code,
              id,
              name,
            }))}
            tasks={tasks.map(({ id, project, title }) => ({
              id,
              project: { code: project.code, id: project.id },
              title,
            }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}



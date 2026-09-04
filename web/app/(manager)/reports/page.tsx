import { ReportTabs } from "@/components/activity/report-tabs";
import { PageHeading } from "@/components/manager/page-heading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <PageHeading
        description={t.reports.subtitle}
        title={t.reports.title}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t.employees.title} value={String(metrics.employeeCount)} />
        <Metric
          label={t.employees.activeTimeToday}
          value={formatDurationFromSeconds(metrics.activeSeconds, locale)}
        />
        <Metric
          label={t.employees.idleTimeToday}
          value={formatDurationFromSeconds(metrics.idleSeconds, locale)}
        />
        <Metric
          label={t.managerDashboard.openTasks}
          value={String(metrics.overdueTaskCount)}
        />
      </section>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}


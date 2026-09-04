import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ApplicationBreakdown } from "@/components/activity/application-breakdown";
import { ActivityPoller } from "@/components/activity/activity-poller";
import { DwgSummaryCard } from "@/components/activity/dwg-summary-card";
import { HistoricalDateFilter } from "@/components/activity/historical-date-filter";
import { PageHeading } from "@/components/manager/page-heading";
import { RegisterAgentDeviceDialog } from "@/components/manager/register-agent-device-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireManager, toAuthContext } from "@/lib/auth";
import {
  formatActivityDifference,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";
import { formatDayString, parseSafeDate } from "@/lib/services/dwg-reports";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedDate = parseSafeDate(resolvedSearchParams?.day);
  const dayString = formatDayString(selectedDate);

  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const [summary, t] = await Promise.all([
    getEmployeeDaySummary(toAuthContext(session), id, selectedDate),
    getServerDictionary(locale),
  ]);
  const difference = formatActivityDifference(summary.differenceMinutes, locale);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeading
        description={`${summary.employee.department ?? t.tasks.unassigned} · ${summary.employee.position ?? t.common.employee}`}
        title={summary.employee.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HistoricalDateFilter selectedDate={dayString} />
            <RegisterAgentDeviceDialog
              employeeId={id}
              employeeName={summary.employee.name}
            />
            <Badge
              variant={summary.employee.isOnline ? "default" : "secondary"}
            >
              {summary.employee.isOnline ? t.employees.deviceOnline : t.employees.deviceOffline}
            </Badge>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t.employees.activeTimeToday}
          value={formatDurationFromSeconds(summary.activeSeconds, locale)}
        />
        <MetricCard
          label={t.employees.idleTimeToday}
          value={formatDurationFromSeconds(summary.idleSeconds, locale)}
        />
        <MetricCard
          label={t.myTime.title}
          value={formatDurationFromMinutes(summary.manualMinutes, locale)}
        />
        <MetricCard label={t.reports.manualVsTracked} value={difference} />
      </section>
      <DwgSummaryCard items={summary.dwgSummary} />
      <section className="grid gap-6 lg:grid-cols-2">
        <ApplicationBreakdown applications={summary.applications} />
        <Card>
          <CardHeader>
            <CardTitle>{t.employeeDashboard.inProgress}</CardTitle>
            <CardDescription>{t.tasks.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.inProgressTasks.length ? (
              <ul className="space-y-3 text-sm">
                {summary.inProgressTasks.map((task) => (
                  <li key={task.id}>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-muted-foreground">
                      {task.project.code} · {task.project.name}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.tasks.emptyTitle}
              </p>
            )}
          </CardContent>
        </Card>
      </section>
      <ActivityTimeline activities={summary.timeline} />
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}


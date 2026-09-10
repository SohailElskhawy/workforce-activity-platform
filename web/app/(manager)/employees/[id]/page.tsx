import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ApplicationBreakdown } from "@/components/activity/application-breakdown";
import { ActivityPoller } from "@/components/activity/activity-poller";
import { DwgSummaryCard } from "@/components/activity/dwg-summary-card";
import { HistoricalDateFilter } from "@/components/activity/historical-date-filter";
import { EditEmployeeDialog } from "@/components/manager/edit-employee-dialog";
import { EmployeeDevicesCard } from "@/components/manager/employee-devices-card";
import { EmployeeManualTimeCard } from "@/components/manager/employee-manual-time-card";
import { EmployeeLeavesCard } from "@/components/manager/employee-leaves-card";
import { PageHeading } from "@/components/manager/page-heading";
import { RegisterAgentDeviceDialog } from "@/components/manager/register-agent-device-dialog";
import { Badge } from "@/components/ui/badge";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
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
import { listDepartments } from "@/lib/services/employees";
import { listPositionsWithStore } from "@/lib/services/positions";
import { listEmployeeLeavesWithStore } from "@/lib/services/leaves";
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
  const authContext = toAuthContext(session);
  const [summary, departments, positions, leaves, t] = await Promise.all([
    getEmployeeDaySummary(authContext, id, selectedDate),
    listDepartments(authContext),
    listPositionsWithStore(authContext),
    listEmployeeLeavesWithStore(authContext, undefined, id),
    getServerDictionary(locale),
  ]);
  const difference = formatActivityDifference(summary.differenceMinutes, locale);


  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeading
        breadcrumbs={[
          { label: t.common.navigation.employees, href: "/employees" },
          { label: summary.employee.name },
        ]}
        description={`${summary.employee.department ?? t.tasks.unassigned} · ${summary.employee.position ?? t.common.employee} · ${summary.employee.email}`}
        title={summary.employee.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EditEmployeeDialog
              employee={{
                id: summary.employee.id,
                firstName: summary.employee.firstName,
                lastName: summary.employee.lastName,
                email: summary.employee.email,
                phone: summary.employee.phone,
                positionId: summary.employee.positionId,
                status: summary.employee.status,
                departmentId: summary.employee.departmentId,
              }}
              departments={departments}
              positions={positions}
            />
            <HistoricalDateFilter selectedDate={dayString} />
            <RegisterAgentDeviceDialog
              employeeId={id}
              employeeName={summary.employee.name}
            />
            <Badge
              variant={
                summary.employee.status === "ACTIVE"
                  ? "default"
                  : "destructive"
              }
            >
              {summary.employee.status}
            </Badge>
            <Badge
              variant={summary.employee.isOnline ? "default" : "secondary"}
            >
              {summary.employee.isOnline ? t.employees.deviceOnline : t.employees.deviceOffline}
            </Badge>
          </div>
        }
      />
      <KpiGrid>
        <KpiCard
          label={t.employees.activeTimeToday}
          tone="emerald"
          value={formatDurationFromSeconds(summary.activeSeconds, locale)}
        />
        <KpiCard
          label={t.employees.idleTimeToday}
          tone="amber"
          value={formatDurationFromSeconds(summary.idleSeconds, locale)}
        />
        <KpiCard
          label={t.myTime.title}
          tone="sky"
          value={formatDurationFromMinutes(summary.manualMinutes, locale)}
        />
        <KpiCard
          label={t.reports.manualVsTracked}
          tone="violet"
          value={difference}
        />
      </KpiGrid>
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
      <EmployeeManualTimeCard
        entries={summary.manualTimeEntries}
        selectedDate={summary.selectedDate}
      />
      <EmployeeLeavesCard leaves={leaves} />
      <EmployeeDevicesCard devices={summary.employee.devices} />
      <ActivityTimeline activities={summary.timeline} />
    </main>
  );
}

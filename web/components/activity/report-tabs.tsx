"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError } from "@/components/states/data-error";
import { EmptyState } from "@/components/states/empty-state";
import { MapFileDialog } from "@/components/file-mappings/map-file-dialog";
import {
  formatActivityDifference,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { projectTrackedPercentage } from "@/lib/services/activity-presentation";
import type { DwgSummaryRow } from "@/lib/services/dwg-reports";

type EmployeeOption = { id: string; firstName: string; lastName: string };
type ProjectOption = { id: string; code: string; name: string };
type TaskOption = {
  id: string;
  project: { code: string; id?: string };
  title: string;
};
type ReportPayload = Record<string, unknown>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function useReport(url: string | null) {
  const [result, setResult] = useState<{
    data: ReportPayload;
    url: string;
  } | null>(null);
  const [failure, setFailure] = useState<{
    message: string;
    url: string;
  } | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: ReportPayload;
          error?: { message?: string };
        };
        if (!response.ok || !payload.data)
          throw new Error(
            payload.error?.message ?? "Unable to load this report.",
          );
        if (!cancelled) setResult({ data: payload.data, url });
      })
      .catch((caughtError) => {
        if (!cancelled)
          setFailure({
            message:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load this report.",
            url,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount, url]);
  return {
    data: result?.url === url ? result.data : null,
    error: failure?.url === url ? failure.message : null,
    retry: () => {
      setFailure(null);
      setReloadCount((count) => count + 1);
    },
  };
}

function ReportMessage({
  error,
  hasSelection,
  onRetry,
}: {
  error: string | null;
  hasSelection: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (!hasSelection)
    return (
      <EmptyState
        description={t.reports.subtitle}
        title={t.reports.title}
      />
    );
  return error ? (
    <DataError message={error} onRetry={onRetry} />
  ) : (
    <p className="pt-4 text-sm text-muted-foreground">{t.common.loading}</p>
  );
}

export function ReportTabs({
  employees,
  projects,
  tasks,
}: {
  employees: EmployeeOption[];
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const { t } = useI18n();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [day, setDay] = useState(today);
  const employeeReport = useReport(
    employeeId
      ? `/api/reports/employee?employeeId=${encodeURIComponent(employeeId)}&day=${day}`
      : null,
  );
  const projectReport = useReport(
    projectId
      ? `/api/reports/project?projectId=${encodeURIComponent(projectId)}`
      : null,
  );
  const taskReport = useReport(
    taskId ? `/api/reports/task?taskId=${encodeURIComponent(taskId)}` : null,
  );

  const [autocadEmployeeId, setAutocadEmployeeId] = useState("");
  const [autocadProjectId, setAutocadProjectId] = useState("");
  const [autocadDay, setAutocadDay] = useState(today);

  const autocadReportUrl = `/api/reports/autocad?day=${autocadDay}${
    autocadEmployeeId
      ? `&employeeId=${encodeURIComponent(autocadEmployeeId)}`
      : ""
  }${
    autocadProjectId
      ? `&projectId=${encodeURIComponent(autocadProjectId)}`
      : ""
  }`;
  const autocadReport = useReport(autocadReportUrl);

  return (
    <Tabs defaultValue="employee">
      <TabsList>
        <TabsTrigger value="employee">{t.reports.byEmployee}</TabsTrigger>
        <TabsTrigger value="project">{t.reports.byProject}</TabsTrigger>
        <TabsTrigger value="task">{t.tasks.taskDetails}</TabsTrigger>
        <TabsTrigger value="difference">{t.reports.manualVsTracked}</TabsTrigger>
        <TabsTrigger value="autocad">AutoCAD / DWG</TabsTrigger>
      </TabsList>
      <TabsContent value="employee">
        <EmployeePicker
          day={day}
          employeeId={employeeId}
          employees={employees}
          onDayChange={setDay}
          onEmployeeChange={setEmployeeId}
        />
        {employeeReport.data ? (
          <EmployeeMetrics summary={employeeReport.data} />
        ) : (
          <ReportMessage
            error={employeeReport.error}
            hasSelection={Boolean(employeeId)}
            onRetry={employeeReport.retry}
          />
        )}
      </TabsContent>
      <TabsContent value="project">
        <label className="grid gap-1 pt-4 text-sm">
          {t.tasks.project}
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5"
            onChange={(event) => setProjectId(event.target.value)}
            value={projectId}
          >
            <option value="">{t.tasks.selectProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>
        {projectReport.data ? (
          <ProjectMetrics summary={projectReport.data} />
        ) : (
          <ReportMessage
            error={projectReport.error}
            hasSelection={Boolean(projectId)}
            onRetry={projectReport.retry}
          />
        )}
      </TabsContent>
      <TabsContent value="task">
        <label className="grid gap-1 pt-4 text-sm">
          {t.tasks.taskTitle}
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5"
            onChange={(event) => setTaskId(event.target.value)}
            value={taskId}
          >
            <option value="">{t.tasks.newTask}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.project.code} — {task.title}
              </option>
            ))}
          </select>
        </label>
        {taskReport.data ? (
          <TaskMetrics summary={taskReport.data} />
        ) : (
          <ReportMessage
            error={taskReport.error}
            hasSelection={Boolean(taskId)}
            onRetry={taskReport.retry}
          />
        )}
      </TabsContent>
      <TabsContent value="difference">
        <EmployeePicker
          day={day}
          employeeId={employeeId}
          employees={employees}
          onDayChange={setDay}
          onEmployeeChange={setEmployeeId}
        />
        {employeeReport.data ? (
          <DifferenceMetrics summary={employeeReport.data} />
        ) : (
          <ReportMessage
            error={employeeReport.error}
            hasSelection={Boolean(employeeId)}
            onRetry={employeeReport.retry}
          />
        )}
      </TabsContent>
      <TabsContent value="autocad">
        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            {t.myTime.date}
            <input
              className="h-8 rounded-lg border border-input bg-transparent px-2.5"
              onChange={(event) => setAutocadDay(event.target.value)}
              type="date"
              value={autocadDay}
            />
          </label>
          <label className="grid gap-1 text-sm">
            {t.common.employee}
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5"
              onChange={(event) => setAutocadEmployeeId(event.target.value)}
              value={autocadEmployeeId}
            >
              <option value="">{t.activities.allEmployees}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            {t.tasks.project}
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5"
              onChange={(event) => setAutocadProjectId(event.target.value)}
              value={autocadProjectId}
            >
              <option value="">{t.activities.allProjects}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {autocadReport.data ? (
          <AutoCadReportContent
            projects={projects}
            summary={autocadReport.data}
            tasks={tasks.map((task) => ({
              id: task.id,
              project: { id: task.project.id ?? "" },
              title: task.title,
            }))}
          />
        ) : (
          <ReportMessage
            error={autocadReport.error}
            hasSelection={true}
            onRetry={autocadReport.retry}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function AutoCadReportContent({
  summary,
  projects,
  tasks,
}: {
  summary: ReportPayload;
  projects: ProjectOption[];
  tasks: Array<{ id: string; project: { id: string }; title: string }>;
}) {
  const { locale } = useI18n();
  const rows = (summary.rows as DwgSummaryRow[]) || [];

  if (!rows.length) {
    return (
      <div className="pt-4">
        <EmptyState
          title="No AutoCAD activity"
          description="No active AutoCAD drawing time detected for the selected date and filters."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <tr>
            <th className="p-3">Employee</th>
            <th className="p-3">DWG File</th>
            <th className="p-3">Project</th>
            <th className="p-3">Task</th>
            <th className="p-3">Active Duration</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, idx) => (
            <tr
              key={`${row.employeeId}-${row.normalizedFileName}-${row.projectId}-${row.taskId}-${idx}`}
              className="hover:bg-muted/20"
            >
              <td className="p-3 font-medium text-foreground">
                {row.employeeName}
              </td>
              <td className="p-3 font-semibold text-foreground">
                {row.fileName}
              </td>
              <td className="p-3 text-muted-foreground">
                {row.projectName
                  ? `${row.projectCode ? `${row.projectCode} · ` : ""}${row.projectName}`
                  : "—"}
              </td>
              <td className="p-3 text-muted-foreground">
                {row.taskTitle ?? "—"}
              </td>
              <td className="p-3 font-medium text-foreground">
                {formatDurationFromSeconds(row.activeSeconds, locale)}
              </td>
              <td className="p-3">
                <Badge variant={row.isMapped ? "default" : "secondary"}>
                  {row.isMapped ? "Mapped" : "Unmapped"}
                </Badge>
              </td>
              <td className="p-3 text-right">
                {!row.isMapped ? (
                  <MapFileDialog
                    initialFileName={row.fileName}
                    projects={projects}
                    tasks={tasks}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        Map
                      </Button>
                    }
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeePicker({
  day,
  employeeId,
  employees,
  onDayChange,
  onEmployeeChange,
}: {
  day: string;
  employeeId: string;
  employees: EmployeeOption[];
  onDayChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid gap-3 pt-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        {t.common.employee}
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2.5"
          onChange={(event) => onEmployeeChange(event.target.value)}
          value={employeeId}
        >
          <option value="">{t.tasks.selectEmployees}</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        {t.myTime.date}
        <input
          className="h-8 rounded-lg border border-input bg-transparent px-2.5"
          onChange={(event) => onDayChange(event.target.value)}
          type="date"
          value={day}
        />
      </label>
    </div>
  );
}

function EmployeeMetrics({ summary }: { summary: ReportPayload }) {
  return (
    <Metrics
      activeSeconds={Number(summary.activeSeconds ?? 0)}
      differenceMinutes={Number(summary.differenceMinutes ?? 0)}
      idleSeconds={Number(summary.idleSeconds ?? 0)}
      manualMinutes={Number(summary.manualMinutes ?? 0)}
    />
  );
}
function DifferenceMetrics({ summary }: { summary: ReportPayload }) {
  return (
    <Metrics
      activeSeconds={Number(summary.activeSeconds ?? 0)}
      differenceMinutes={Number(summary.differenceMinutes ?? 0)}
      idleSeconds={0}
      manualMinutes={Number(summary.manualMinutes ?? 0)}
      differenceOnly
    />
  );
}
function ProjectMetrics({ summary }: { summary: ReportPayload }) {
  const activeSeconds = Number(summary.activeSeconds ?? 0);
  const estimatedHours =
    typeof summary.estimatedHours === "number" ? summary.estimatedHours : null;
  const trackedPercentage = projectTrackedPercentage(
    activeSeconds,
    estimatedHours,
  );
  return (
    <div className="space-y-4">
      <Metrics
        activeSeconds={activeSeconds}
        differenceMinutes={Number(summary.differenceMinutes ?? 0)}
        idleSeconds={0}
        manualMinutes={Number(summary.manualMinutes ?? 0)}
        differenceOnly
      />
      {trackedPercentage === null ? (
        <p className="text-sm text-muted-foreground">
          —
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{trackedPercentage}% of {estimatedHours}h</span>
          </div>
          <progress
            aria-label="Tracked activity versus estimate"
            className="h-2 w-full"
            max="100"
            value={trackedPercentage}
          />
        </div>
      )}
    </div>
  );
}
function TaskMetrics({ summary }: { summary: ReportPayload }) {
  return (
    <Metrics
      activeSeconds={Number(summary.activeSeconds ?? 0)}
      differenceMinutes={Number(summary.differenceMinutes ?? 0)}
      idleSeconds={0}
      manualMinutes={Number(summary.manualMinutes ?? 0)}
      differenceOnly
    />
  );
}

function Metrics({
  activeSeconds,
  differenceMinutes,
  idleSeconds,
  manualMinutes,
  differenceOnly = false,
}: {
  activeSeconds: number;
  differenceMinutes: number;
  idleSeconds: number;
  manualMinutes: number;
  differenceOnly?: boolean;
}) {
  const { locale, t } = useI18n();

  return (
    <dl className="grid gap-3 pt-4 sm:grid-cols-3">
      <Metric
        label={differenceOnly ? t.projects.trackedActivity : t.managerDashboard.active}
        value={formatDurationFromSeconds(activeSeconds, locale)}
      />
      {differenceOnly ? (
        <Metric
          label={t.myTime.title}
          value={formatDurationFromMinutes(manualMinutes, locale)}
        />
      ) : (
        <Metric label={t.managerDashboard.idle} value={formatDurationFromSeconds(idleSeconds, locale)} />
      )}
      <Metric
        label={differenceOnly ? t.reports.manualVsTracked : t.myTime.title}
        value={
          differenceOnly
            ? formatActivityDifference(differenceMinutes, locale)
            : formatDurationFromMinutes(manualMinutes, locale)
        }
      />
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}


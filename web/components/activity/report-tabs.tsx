"use client";

import { useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError } from "@/components/states/data-error";
import { EmptyState } from "@/components/states/empty-state";
import {
  formatActivityDifference,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import { projectTrackedPercentage } from "@/lib/services/activity-presentation";

type EmployeeOption = { id: string; firstName: string; lastName: string };
type ProjectOption = { id: string; code: string; name: string };
type TaskOption = { id: string; project: { code: string }; title: string };
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
  if (!hasSelection)
    return (
      <EmptyState
        description="Choose an employee, project, or task to view its report."
        title="Select a record to view its summary."
      />
    );
  return error ? (
    <DataError message={error} onRetry={onRetry} />
  ) : (
    <p className="pt-4 text-sm text-muted-foreground">Loading report…</p>
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

  return (
    <Tabs defaultValue="employee">
      <TabsList>
        <TabsTrigger value="employee">Employee Summary</TabsTrigger>
        <TabsTrigger value="project">Project Summary</TabsTrigger>
        <TabsTrigger value="task">Task Summary</TabsTrigger>
        <TabsTrigger value="difference">Manual vs Activity</TabsTrigger>
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
          Project
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5"
            onChange={(event) => setProjectId(event.target.value)}
            value={projectId}
          >
            <option value="">Select a project</option>
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
          Task
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5"
            onChange={(event) => setTaskId(event.target.value)}
            value={taskId}
          >
            <option value="">Select a task</option>
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
    </Tabs>
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
  return (
    <div className="grid gap-3 pt-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        Employee
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2.5"
          onChange={(event) => onEmployeeChange(event.target.value)}
          value={employeeId}
        >
          <option value="">Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Date
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
          No project estimate is available for a tracked-versus-estimate
          comparison.
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Tracked activity vs estimate</span>
            <span>
              {trackedPercentage}% of {estimatedHours}h
            </span>
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
  return (
    <dl className="grid gap-3 pt-4 sm:grid-cols-3">
      <Metric
        label={differenceOnly ? "Tracked activity" : "Active"}
        value={formatDurationFromSeconds(activeSeconds)}
      />
      {differenceOnly ? (
        <Metric
          label="Manual time"
          value={formatDurationFromMinutes(manualMinutes)}
        />
      ) : (
        <Metric label="Idle" value={formatDurationFromSeconds(idleSeconds)} />
      )}
      <Metric
        label={differenceOnly ? "Neutral difference" : "Manual time"}
        value={
          differenceOnly
            ? formatActivityDifference(differenceMinutes)
            : formatDurationFromMinutes(manualMinutes)
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

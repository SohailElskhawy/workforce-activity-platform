import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignEmployeeDialog } from "@/components/manager/assign-employee-dialog";
import { EditTaskDialog } from "@/components/manager/edit-task-dialog";
import { UnassignEmployeeButton } from "@/components/manager/unassign-employee-button";
import { EmptyState } from "@/components/states/empty-state";
import { PriorityBadge } from "@/components/manager/priority-badge";
import { StatusBadge } from "@/components/manager/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { ApiError } from "@/lib/http/errors";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listEmployees } from "@/lib/services/employees";
import { getTask } from "@/lib/services/tasks";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  let task;

  try {
    task = await getTask(context, id);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const [employees, t] = await Promise.all([
    listEmployees(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            className="text-sm text-muted-foreground hover:text-foreground"
            href="/tasks"
          >
            ← {t.tasks.title}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {task.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link
              className="hover:underline"
              href={`/projects/${task.project.id}`}
            >
              {task.project.code} — {task.project.name}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditTaskDialog
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              estimatedMinutes: task.estimatedMinutes,
              dueDate: task.dueDate,
            }}
          />
          <AssignEmployeeDialog
            employees={employees.map(
              ({ email, firstName, id: employeeId, lastName }) => ({
                email,
                firstName,
                id: employeeId,
                lastName,
              }),
            )}
            taskId={task.id}
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.tasks.taskDetails}</CardTitle>
          <CardDescription>
            {task.description ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">{t.projects.status}</p>
            <div className="mt-1">
              <StatusBadge value={task.status} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">{t.tasks.priority}</p>
            <div className="mt-1">
              <PriorityBadge value={task.priority} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">{t.myTime.duration}</p>
            <p className="mt-1 font-medium">
              {formatDurationFromMinutes(task.estimatedMinutes, locale)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.tasks.dueDate}</p>
            <p className="mt-1 font-medium">{formatDate(task.dueDate, locale)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.tasks.assignees}</CardTitle>
          <CardDescription>
            {t.tasks.assignEmployeeDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {task.assignments.length ? (
            <div className="divide-y rounded-lg border">
              {task.assignments.map((assignment) => (
                <div
                  className="flex items-center justify-between gap-4 p-3"
                  key={assignment.id}
                >
                  <div>
                    <p className="font-medium">
                      {assignment.employee.firstName}{" "}
                      {assignment.employee.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {assignment.employee.position ??
                        assignment.employee.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(assignment.assignedAt, locale)}
                    </p>
                    <UnassignEmployeeButton
                      taskId={task.id}
                      employeeId={assignment.employee.id}
                      employeeName={`${assignment.employee.firstName} ${assignment.employee.lastName}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description={t.tasks.emptyDesc}
              title={t.tasks.unassigned}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}


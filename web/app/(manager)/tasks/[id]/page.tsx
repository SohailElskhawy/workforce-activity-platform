import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignEmployeeDialog } from "@/components/manager/assign-employee-dialog";
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
import { listEmployees } from "@/lib/services/employees";
import { getTask } from "@/lib/services/tasks";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = toAuthContext(await requireManager());
  let task;

  try {
    task = await getTask(context, id);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const employees = await listEmployees(context);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            className="text-sm text-muted-foreground hover:text-foreground"
            href="/tasks"
          >
            ← Tasks
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
      <Card>
        <CardHeader>
          <CardTitle>Task details</CardTitle>
          <CardDescription>
            {task.description ?? "No description provided."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge value={task.status} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Priority</p>
            <div className="mt-1">
              <PriorityBadge value={task.priority} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Estimate</p>
            <p className="mt-1 font-medium">
              {formatDurationFromMinutes(task.estimatedMinutes)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Due date</p>
            <p className="mt-1 font-medium">{formatDate(task.dueDate)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Assigned employees</CardTitle>
          <CardDescription>
            People currently responsible for this task.
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
                  <p className="text-xs text-muted-foreground">
                    Assigned {formatDate(assignment.assignedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Assign an employee when this task is ready to begin."
              title="No employees have been assigned yet."
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

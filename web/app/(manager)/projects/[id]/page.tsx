import Link from "next/link";
import { notFound } from "next/navigation";

import { PriorityBadge } from "@/components/manager/priority-badge";
import { EmptyState } from "@/components/states/empty-state";
import { StatusBadge } from "@/components/manager/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireManager, toAuthContext } from "@/lib/auth";
import { ApiError } from "@/lib/http/errors";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { getProject } from "@/lib/services/projects";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = toAuthContext(await requireManager());
  let project;

  try {
    project = await getProject(context, id);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div>
        <Link
          className="text-sm text-muted-foreground hover:text-foreground"
          href="/projects"
        >
          ← Projects
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.code} · {project.clientName ?? "No client recorded"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            {project.description ?? "No description provided."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge value={project.status} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Estimated hours</p>
            <p className="mt-1 font-medium">{project.estimatedHours ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Start date</p>
            <p className="mt-1 font-medium">{formatDate(project.startDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">End date</p>
            <p className="mt-1 font-medium">{formatDate(project.endDate)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Work items currently associated with this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {project.tasks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Assignees</TableHead>
                  <TableHead>Due date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/tasks/${task.id}`}
                      >
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={task.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge value={task.priority} />
                    </TableCell>
                    <TableCell>
                      {formatDurationFromMinutes(task.estimatedMinutes)}
                    </TableCell>
                    <TableCell>{task._count.assignments}</TableCell>
                    <TableCell>{formatDate(task.dueDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description="Create a task to begin tracking work for this project."
              title="No tasks for this project yet."
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

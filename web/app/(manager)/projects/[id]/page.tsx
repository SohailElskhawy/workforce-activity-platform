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
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getProject } from "@/lib/services/projects";

export default async function ProjectDetailPage({
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
  let project;

  try {
    project = await getProject(context, id);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const t = await getServerDictionary(locale);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div>
        <Link
          className="text-sm text-muted-foreground hover:text-foreground"
          href="/projects"
        >
          ← {t.projects.title}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.code} · {project.clientName ?? t.managerDashboard.internalProject}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.projects.projectDetails}</CardTitle>
          <CardDescription>
            {project.description ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">{t.projects.status}</p>
            <div className="mt-1">
              <StatusBadge value={project.status} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">{t.projects.estimatedHours}</p>
            <p className="mt-1 font-medium">{project.estimatedHours ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.projects.startDate}</p>
            <p className="mt-1 font-medium">{formatDate(project.startDate, locale)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.projects.endDate}</p>
            <p className="mt-1 font-medium">{formatDate(project.endDate, locale)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.projects.assignedTasks}</CardTitle>
          <CardDescription>
            {t.tasks.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {project.tasks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tasks.taskTitle}</TableHead>
                  <TableHead>{t.projects.status}</TableHead>
                  <TableHead>{t.tasks.priority}</TableHead>
                  <TableHead>{t.myTime.duration}</TableHead>
                  <TableHead>{t.tasks.assignees}</TableHead>
                  <TableHead>{t.tasks.dueDate}</TableHead>
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
                      {formatDurationFromMinutes(task.estimatedMinutes, locale)}
                    </TableCell>
                    <TableCell>{task._count.assignments}</TableCell>
                    <TableCell>{formatDate(task.dueDate, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description={t.projects.noTasks}
              title={t.tasks.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}


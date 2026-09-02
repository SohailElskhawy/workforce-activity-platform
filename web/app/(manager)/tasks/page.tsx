import Link from "next/link";

import { CreateTaskDialog } from "@/components/manager/create-task-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeading } from "@/components/manager/page-heading";
import { PriorityBadge } from "@/components/manager/priority-badge";
import { StatusBadge } from "@/components/manager/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireManager, toAuthContext } from "@/lib/auth";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";

export default async function TasksPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const [projects, tasks, t] = await Promise.all([
    listProjects(context),
    listTasks(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeading
        action={
          <CreateTaskDialog
            projects={projects.map(({ code, id, name }) => ({
              code,
              id,
              name,
            }))}
          />
        }
        description={t.tasks.subtitle}
        title={t.tasks.title}
      />
      <Card>
        <CardContent className="pt-0">
          {tasks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tasks.taskTitle}</TableHead>
                  <TableHead>{t.tasks.project}</TableHead>
                  <TableHead>{t.projects.status}</TableHead>
                  <TableHead>{t.tasks.priority}</TableHead>
                  <TableHead>{t.tasks.assignees}</TableHead>
                  <TableHead>{t.tasks.dueDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/tasks/${task.id}`}
                      >
                        {task.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDurationFromMinutes(task.estimatedMinutes, locale)}
                      </div>
                    </TableCell>
                    <TableCell>{task.project.code}</TableCell>
                    <TableCell>
                      <StatusBadge value={task.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge value={task.priority} />
                    </TableCell>
                    <TableCell>
                      {task.assignments.length
                        ? task.assignments
                            .map(
                              ({ employee }) =>
                                `${employee.firstName} ${employee.lastName}`,
                            )
                            .join(", ")
                        : t.tasks.unassigned}
                    </TableCell>
                    <TableCell>{formatDate(task.dueDate, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description={t.tasks.emptyDesc}
              title={t.tasks.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}


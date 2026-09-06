import { UpdateTaskStatus } from "@/components/employee/update-task-status";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { DataTableCard } from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listOwnTasks } from "@/lib/services/employee-self";

export default async function MyTasksPage() {
  const [session, locale] = await Promise.all([
    requireEmployee(),
    getServerLocale(),
  ]);
  const [tasks, t] = await Promise.all([
    listOwnTasks(toAuthContext(session)),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeader
        description={t.myTasks.subtitle}
        title={t.myTasks.title}
      />
      <DataTableCard>
        {tasks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tasks.taskTitle}</TableHead>
                  <TableHead>{t.tasks.project}</TableHead>
                  <TableHead>{t.tasks.priority}</TableHead>
                  <TableHead>{t.myTime.duration}</TableHead>
                  <TableHead>{t.tasks.dueDate}</TableHead>
                  <TableHead>{t.projects.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(({ task }) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.title}</div>
                      <div className="max-w-64 truncate text-xs text-muted-foreground">
                        {task.description ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>{task.project.code}</TableCell>
                    <TableCell>
                      <PriorityBadge value={task.priority} />
                    </TableCell>
                    <TableCell>
                      {formatDurationFromMinutes(task.estimatedMinutes, locale)}
                    </TableCell>
                    <TableCell>{formatDate(task.dueDate, locale)}</TableCell>
                    <TableCell>
                      <UpdateTaskStatus status={task.status} taskId={task.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description={t.myTasks.emptyDesc}
              title={t.myTasks.emptyTitle}
            />
          )}
      </DataTableCard>
    </main>
  );
}


import { AddTimeEntryDialog } from "@/components/employee/add-time-entry-dialog";
import { DeleteTimeEntryButton } from "@/components/employee/delete-time-entry-button";
import { EditTimeEntryDialog } from "@/components/employee/edit-time-entry-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent } from "@/components/ui/card";
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
import { listOwnProjects, listOwnTasks } from "@/lib/services/employee-self";
import { listOwnTimeEntries } from "@/lib/services/time-entries";

export default async function MyTimePage() {
  const [session, locale] = await Promise.all([
    requireEmployee(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const [entries, projects, assignments, t] = await Promise.all([
    listOwnTimeEntries(context),
    listOwnProjects(context),
    listOwnTasks(context),
    getServerDictionary(locale),
  ]);
  const tasks = assignments.map(({ task }) => ({
    id: task.id,
    projectId: task.project.id,
    title: task.title,
  }));

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.myTime.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.myTime.subtitle}
          </p>
        </div>
        <AddTimeEntryDialog
          projects={projects.map(({ code, id, name }) => ({ code, id, name }))}
          tasks={tasks}
        />
      </div>
      <Card>
        <CardContent className="pt-0">
          {entries.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.myTime.date}</TableHead>
                  <TableHead>{t.tasks.project}</TableHead>
                  <TableHead>{t.tasks.taskTitle}</TableHead>
                  <TableHead>{t.myTime.duration}</TableHead>
                  <TableHead>{t.myTime.notes}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.startAt, locale)}</TableCell>
                    <TableCell>
                      {entry.project.code} — {entry.project.name}
                    </TableCell>
                    <TableCell>{entry.task?.title ?? "—"}</TableCell>
                    <TableCell>
                      {formatDurationFromMinutes(entry.durationMinutes, locale)}
                    </TableCell>
                    <TableCell className="max-w-64 truncate">
                      {entry.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditTimeEntryDialog
                          entry={{
                            id: entry.id,
                            projectId: entry.projectId,
                            taskId: entry.taskId,
                            startAt: entry.startAt,
                            endAt: entry.endAt,
                            notes: entry.notes,
                          }}
                          projects={projects.map(({ code, id, name }) => ({
                            code,
                            id,
                            name,
                          }))}
                          tasks={tasks}
                        />
                        <DeleteTimeEntryButton id={entry.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description={t.myTime.emptyDesc}
              title={t.myTime.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}


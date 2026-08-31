import { AddTimeEntryDialog } from "@/components/employee/add-time-entry-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { listOwnProjects, listOwnTasks } from "@/lib/services/employee-self";
import { listOwnTimeEntries } from "@/lib/services/time-entries";

export default async function MyTimePage() {
  const context = toAuthContext(await requireEmployee());
  const [entries, projects, assignments] = await Promise.all([listOwnTimeEntries(context), listOwnProjects(context), listOwnTasks(context)]);
  const tasks = assignments.map(({ task }) => ({ id: task.id, projectId: task.project.id, title: task.title }));

  return <main className="flex-1 space-y-6 p-6 md:p-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-semibold tracking-tight">My Time</h1><p className="mt-1 text-sm text-muted-foreground">Manual entries are kept separate from automatic activity.</p></div><AddTimeEntryDialog projects={projects.map(({ code, id, name }) => ({ code, id, name }))} tasks={tasks} /></div><Card><CardContent className="pt-0">{entries.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Project</TableHead><TableHead>Task</TableHead><TableHead>Duration</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>{entries.map((entry) => <TableRow key={entry.id}><TableCell>{formatDate(entry.startAt)}</TableCell><TableCell>{entry.project.code} — {entry.project.name}</TableCell><TableCell>{entry.task?.title ?? "—"}</TableCell><TableCell>{formatDurationFromMinutes(entry.durationMinutes)}</TableCell><TableCell className="max-w-64 truncate">{entry.notes ?? "—"}</TableCell></TableRow>)}</TableBody></Table> : <p className="py-10 text-center text-sm text-muted-foreground">No manual time entries yet.</p>}</CardContent></Card></main>;
}

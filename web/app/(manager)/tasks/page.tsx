import Link from "next/link";

import { CreateTaskDialog } from "@/components/manager/create-task-dialog";
import { PageHeading } from "@/components/manager/page-heading";
import { PriorityBadge } from "@/components/manager/priority-badge";
import { StatusBadge } from "@/components/manager/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireManager, toAuthContext } from "@/lib/auth";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";

export default async function TasksPage() {
  const context = toAuthContext(await requireManager());
  const [projects, tasks] = await Promise.all([listProjects(context), listTasks(context)]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeading action={<CreateTaskDialog projects={projects.map(({ code, id, name }) => ({ code, id, name }))} />} description="Assign and monitor project work across your company." title="Tasks" />
      <Card><CardContent className="pt-0">{tasks.length ? <Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Assignees</TableHead><TableHead>Due date</TableHead></TableRow></TableHeader><TableBody>{tasks.map((task) => <TableRow key={task.id}><TableCell><Link className="font-medium hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link><div className="text-xs text-muted-foreground">{formatDurationFromMinutes(task.estimatedMinutes)}</div></TableCell><TableCell>{task.project.code}</TableCell><TableCell><StatusBadge value={task.status} /></TableCell><TableCell><PriorityBadge value={task.priority} /></TableCell><TableCell>{task.assignments.length ? task.assignments.map(({ employee }) => `${employee.firstName} ${employee.lastName}`).join(", ") : "Unassigned"}</TableCell><TableCell>{formatDate(task.dueDate)}</TableCell></TableRow>)}</TableBody></Table> : <p className="py-10 text-center text-sm text-muted-foreground">No tasks yet. Create a task after creating a project.</p>}</CardContent></Card>
    </main>
  );
}

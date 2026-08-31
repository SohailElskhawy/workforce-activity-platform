import { UpdateTaskStatus } from "@/components/employee/update-task-status";
import { PriorityBadge } from "@/components/manager/priority-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import { formatDate, formatDurationFromMinutes } from "@/lib/formatters";
import { listOwnTasks } from "@/lib/services/employee-self";

export default async function MyTasksPage() {
  const tasks = await listOwnTasks(toAuthContext(await requireEmployee()));

  return <main className="flex-1 space-y-6 p-6 md:p-10"><div><h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1><p className="mt-1 text-sm text-muted-foreground">Only tasks assigned to you appear here.</p></div><Card><CardContent className="pt-0">{tasks.length ? <Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Priority</TableHead><TableHead>Estimate</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{tasks.map(({ task }) => <TableRow key={task.id}><TableCell><div className="font-medium">{task.title}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{task.description ?? "No description"}</div></TableCell><TableCell>{task.project.code}</TableCell><TableCell><PriorityBadge value={task.priority} /></TableCell><TableCell>{formatDurationFromMinutes(task.estimatedMinutes)}</TableCell><TableCell>{formatDate(task.dueDate)}</TableCell><TableCell><UpdateTaskStatus status={task.status} taskId={task.id} /></TableCell></TableRow>)}</TableBody></Table> : <p className="py-10 text-center text-sm text-muted-foreground">You do not have assigned tasks yet.</p>}</CardContent></Card></main>;
}

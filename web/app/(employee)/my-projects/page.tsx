import { StatusBadge } from "@/components/manager/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { listOwnProjects } from "@/lib/services/employee-self";

export default async function MyProjectsPage() {
  const projects = await listOwnProjects(toAuthContext(await requireEmployee()));

  return <main className="flex-1 space-y-6 p-6 md:p-10"><div><h1 className="text-2xl font-semibold tracking-tight">My Projects</h1><p className="mt-1 text-sm text-muted-foreground">Projects connected to your assigned tasks.</p></div><Card><CardContent className="pt-0">{projects.length ? <Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead>Tasks</TableHead><TableHead>End date</TableHead></TableRow></TableHeader><TableBody>{projects.map((project) => <TableRow key={project.id}><TableCell className="font-medium">{project.code} — {project.name}</TableCell><TableCell>{project.clientName ?? "—"}</TableCell><TableCell><StatusBadge value={project.status} /></TableCell><TableCell>{project._count.tasks}</TableCell><TableCell>{formatDate(project.endDate)}</TableCell></TableRow>)}</TableBody></Table> : <p className="py-10 text-center text-sm text-muted-foreground">You are not assigned to a project yet.</p>}</CardContent></Card></main>;
}

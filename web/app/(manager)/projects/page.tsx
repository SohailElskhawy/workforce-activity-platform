import Link from "next/link";

import { CreateProjectDialog } from "@/components/manager/create-project-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeading } from "@/components/manager/page-heading";
import { StatusBadge } from "@/components/manager/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireManager, toAuthContext } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { listProjects } from "@/lib/services/projects";

export default async function ProjectsPage() {
  const projects = await listProjects(toAuthContext(await requireManager()));

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeading action={<CreateProjectDialog />} description="Plan and track work across your company." title="Projects" />
      <Card><CardContent className="pt-0">
        {projects.length ? <Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead>Tasks</TableHead><TableHead>End date</TableHead></TableRow></TableHeader><TableBody>
          {projects.map((project) => <TableRow key={project.id}><TableCell><Link className="font-medium hover:underline" href={`/projects/${project.id}`}>{project.code} — {project.name}</Link></TableCell><TableCell>{project.clientName ?? "—"}</TableCell><TableCell><StatusBadge value={project.status} /></TableCell><TableCell>{project._count.tasks}</TableCell><TableCell>{formatDate(project.endDate)}</TableCell></TableRow>)}
        </TableBody></Table> : <EmptyState description="Create your first project to start assigning work." title="No projects yet." />}
      </CardContent></Card>
    </main>
  );
}

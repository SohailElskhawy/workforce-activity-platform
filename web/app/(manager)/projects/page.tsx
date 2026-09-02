import Link from "next/link";

import { CreateProjectDialog } from "@/components/manager/create-project-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeading } from "@/components/manager/page-heading";
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
import { formatDate } from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listProjects } from "@/lib/services/projects";

export default async function ProjectsPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const [projects, t] = await Promise.all([
    listProjects(toAuthContext(session)),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeading
        action={<CreateProjectDialog />}
        description={t.projects.subtitle}
        title={t.projects.title}
      />
      <Card>
        <CardContent className="pt-0">
          {projects.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.projects.title}</TableHead>
                  <TableHead>{t.projects.client}</TableHead>
                  <TableHead>{t.projects.status}</TableHead>
                  <TableHead>{t.tasks.title}</TableHead>
                  <TableHead>{t.projects.endDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/projects/${project.id}`}
                      >
                        {project.code} — {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>{project.clientName ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge value={project.status} />
                    </TableCell>
                    <TableCell>{project._count.tasks}</TableCell>
                    <TableCell>{formatDate(project.endDate, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description={t.projects.emptyDesc}
              title={t.projects.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}


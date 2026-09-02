import { StatusBadge } from "@/components/manager/status-badge";
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
import { formatDate } from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listOwnProjects } from "@/lib/services/employee-self";

export default async function MyProjectsPage() {
  const [session, locale] = await Promise.all([
    requireEmployee(),
    getServerLocale(),
  ]);
  const [projects, t] = await Promise.all([
    listOwnProjects(toAuthContext(session)),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.myProjects.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.myProjects.subtitle}
        </p>
      </div>
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
                    <TableCell className="font-medium">
                      {project.code} — {project.name}
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
              description={t.myProjects.emptyDesc}
              title={t.myProjects.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}


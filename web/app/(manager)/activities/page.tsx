import Link from "next/link";

import { MapFileDialog } from "@/components/file-mappings/map-file-dialog";
import { PageHeading } from "@/components/manager/page-heading";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listEmployees } from "@/lib/services/employees";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";

export default async function ActivitiesPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const [employees, projects, tasks, t] = await Promise.all([
    listEmployees(context),
    listProjects(context),
    listTasks(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeading
        action={
          <MapFileDialog
            projects={projects.map(({ code, id, name }) => ({
              code,
              id,
              name,
            }))}
            tasks={tasks.map(({ id, project, title }) => ({
              id,
              project: { id: project.id },
              title,
            }))}
          />
        }
        description={t.activities.subtitle}
        title={t.activities.title}
      />
      {employees.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      {employee.firstName} {employee.lastName}
                    </CardTitle>
                    <CardDescription>
                      {employee.department?.name ?? t.tasks.unassigned}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        employee.agentStatus === "ONLINE"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {employee.agentStatus === "ONLINE"
                        ? t.employees.deviceOnline
                        : employee.agentStatus === "OFFLINE"
                          ? t.employees.deviceOffline
                          : t.employees.noDevice}
                    </Badge>
                    {employee.agentDeviceName ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {employee.agentDeviceName}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link
                  className="text-sm font-medium text-primary hover:underline"
                  href={`/employees/${employee.id}`}
                >
                  {t.employeeDashboard.viewActivity}
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          description={t.employees.emptyDesc}
          title={t.employees.emptyTitle}
        />
      )}
    </main>
  );
}


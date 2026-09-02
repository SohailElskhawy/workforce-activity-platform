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
import { listEmployees } from "@/lib/services/employees";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";

export default async function ActivitiesPage() {
  const context = toAuthContext(await requireManager());
  const [employees, projects, tasks] = await Promise.all([
    listEmployees(context),
    listProjects(context),
    listTasks(context),
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
        description="Open an employee to review their captured activity timeline and application time, or map a DWG file for future activity."
        title="Activities"
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
                      {employee.department?.name ?? "Unassigned"}
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
                      {employee.agentStatus.replaceAll("_", " ")}
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
                  View activity timeline
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          description="Employees must be added before their captured activity can be reviewed."
          title="No employees are available."
        />
      )}
    </main>
  );
}

import { PageHeader } from "@/components/layout/page-header";
import { TimeEntriesView } from "@/components/manager/time-entries-view";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listDepartmentsWithDetails } from "@/lib/services/departments";
import { listEmployees } from "@/lib/services/employees";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";
import { listCompanyTimeEntries } from "@/lib/services/time-entries";

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    employeeId?: string;
    departmentId?: string;
    projectId?: string;
    taskId?: string;
  }>;
}) {
  const [session, locale, params] = await Promise.all([
    requireManager(),
    getServerLocale(),
    searchParams,
  ]);
  const context = toAuthContext(session);

  const entries = await listCompanyTimeEntries(context, params);
  const [employees, departments, projects, tasks, t] = await Promise.all([
    listEmployees(context),
    listDepartmentsWithDetails(context),
    listProjects(context),
    listTasks(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeader
        description={t.timeEntries.subtitle}
        title={t.timeEntries.title}
      />
      <TimeEntriesView
        departments={departments.map((dept) => ({ id: dept.id, name: dept.name }))}
        employees={employees.map((emp) => ({
          firstName: emp.firstName,
          id: emp.id,
          lastName: emp.lastName,
        }))}
        entries={entries}
        projects={projects.map((proj) => ({ code: proj.code, id: proj.id, name: proj.name }))}
        tasks={tasks.map((tsk) => ({
          id: tsk.id,
          projectId: tsk.project.id,
          title: tsk.title,
        }))}
      />
    </main>
  );
}

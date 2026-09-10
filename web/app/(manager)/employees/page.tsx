import Link from "next/link";

import { ActivityPoller } from "@/components/activity/activity-poller";
import { CreateEmployeeDialog } from "@/components/manager/create-employee-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { RegisterAgentDeviceDialog } from "@/components/manager/register-agent-device-dialog";
import { PositionManagement } from "@/components/manager/position-management";
import { EmptyState } from "@/components/states/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { DataTableCard } from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listDepartments, listEmployees } from "@/lib/services/employees";
import { listPositionsWithStore } from "@/lib/services/positions";

export default async function EmployeesPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const [departments, employees, positions, t] = await Promise.all([
    listDepartments(context),
    listEmployees(context),
    listPositionsWithStore(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeader
        action={<CreateEmployeeDialog departments={departments} positions={positions} />}
        description={t.employees.subtitle}
        title={t.employees.title}
      />
      <PositionManagement positions={positions} />
      <DataTableCard>
        {employees.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.employee}</TableHead>
                  <TableHead>{t.employees.department}</TableHead>
                  <TableHead>{t.employees.role}</TableHead>
                  <TableHead>{t.projects.assignedTasks}</TableHead>
                  <TableHead>{t.projects.status}</TableHead>
                  <TableHead>{t.employees.title}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t.employees.registerAgentDevice}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/employees/${employee.id}`}
                      >
                        {employee.firstName} {employee.lastName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {employee.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.department?.name ?? t.tasks.unassigned}
                    </TableCell>
                    <TableCell>{employee.position ?? "—"}</TableCell>
                    <TableCell>{employee._count.assignments}</TableCell>
                    <TableCell>
                      <StatusBadge value={employee.status} />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-right">
                      <RegisterAgentDeviceDialog
                        employeeId={employee.id}
                        employeeName={`${employee.firstName} ${employee.lastName}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description={t.employees.emptyDesc}
              title={t.employees.emptyTitle}
            />
          )}
      </DataTableCard>
    </main>
  );
}


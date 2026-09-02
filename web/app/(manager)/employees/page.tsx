import Link from "next/link";

import { ActivityPoller } from "@/components/activity/activity-poller";
import { CreateEmployeeDialog } from "@/components/manager/create-employee-dialog";
import { PageHeading } from "@/components/manager/page-heading";
import { RegisterAgentDeviceDialog } from "@/components/manager/register-agent-device-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { StatusBadge } from "@/components/manager/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { listDepartments, listEmployees } from "@/lib/services/employees";

export default async function EmployeesPage() {
  const context = toAuthContext(await requireManager());
  const [departments, employees] = await Promise.all([
    listDepartments(context),
    listEmployees(context),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeading
        action={<CreateEmployeeDialog departments={departments} />}
        description="People available for project work in your company."
        title="Employees"
      />
      <Card>
        <CardContent className="pt-0">
          {employees.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>
                    <span className="sr-only">Agent device</span>
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
                      {employee.department?.name ?? "Unassigned"}
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
                        {employee.agentStatus.replaceAll("_", " ")}
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
              description="Employees in your company will appear here."
              title="No employees found."
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

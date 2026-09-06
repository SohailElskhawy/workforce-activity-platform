import { Building2, Calendar, ChevronRight, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityPoller } from "@/components/activity/activity-poller";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteDepartmentButton } from "@/components/manager/delete-department-dialog";
import { EditDepartmentDialog } from "@/components/manager/edit-department-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTableCard } from "@/components/ui/data-table";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { ApiError } from "@/lib/http/errors";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getDepartment } from "@/lib/services/departments";
import { listEmployees } from "@/lib/services/employees";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);

  let department;
  try {
    department = await getDepartment(context, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [employees, t] = await Promise.all([
    listEmployees(context),
    getServerDictionary(locale),
  ]);

  const managers = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
  }));

  const managerDisplayName = department.manager
    ? `${department.manager.firstName} ${department.manager.lastName}`
    : t.departments.noManager;

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />

      <PageHeader
        action={
          <div className="flex items-center gap-2">
            <EditDepartmentDialog
              department={{
                id: department.id,
                name: department.name,
                managerId: department.managerId,
              }}
              managers={managers}
            />
            <DeleteDepartmentButton
              departmentId={department.id}
              departmentName={department.name}
              redirectOnSuccess="/departments"
            />
          </div>
        }
        breadcrumbs={[
          { label: t.common.navigation.dashboard, href: "/dashboard" },
          { label: t.departments.title, href: "/departments" },
          { label: department.name },
        ]}
        description={
          department.manager
            ? `${t.departments.manager}: ${department.manager.firstName} ${department.manager.lastName} (${department.manager.email})`
            : t.departments.noManager
        }
        title={department.name}
      />

      <KpiGrid>
        <KpiCard
          icon={Users}
          label={t.departments.totalMembers}
          tone="emerald"
          value={department._count.employees}
        />
        <KpiCard
          icon={UserCheck}
          label={t.departments.manager}
          tone={department.manager ? "sky" : "amber"}
          value={managerDisplayName}
          description={department.manager?.position ?? department.manager?.email ?? undefined}
        />
        <KpiCard
          icon={Calendar}
          label={t.common.created}
          tone="violet"
          value={formatDate(department.createdAt, locale)}
        />
      </KpiGrid>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.departments.assignedEmployees}</CardTitle>
              <CardDescription>
                {t.departments.assignedEmployeesDesc}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Users className="size-3.5 text-muted-foreground" />
              <span>{department.employees.length}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {department.employees.length === 0 ? (
            <EmptyState
              description={t.departments.noEmployees}
              title={t.employees.emptyTitle}
            />
          ) : (
            <DataTableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.employee}</TableHead>
                    <TableHead>{t.employees.role}</TableHead>
                    <TableHead>{t.projects.status}</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">{t.common.actions}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {department.employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <Link
                          className="font-medium hover:underline text-foreground"
                          href={`/employees/${emp.id}`}
                        >
                          {emp.firstName} {emp.lastName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {emp.email}
                        </div>
                      </TableCell>
                      <TableCell>{emp.position ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge value={emp.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          href={`/employees/${emp.id}`}
                          aria-label={t.common.view}
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableCard>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

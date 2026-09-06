import { AlertCircle, Building2, Users } from "lucide-react";

import { ActivityPoller } from "@/components/activity/activity-poller";
import { PageHeader } from "@/components/layout/page-header";
import { CreateDepartmentDialog } from "@/components/manager/create-department-dialog";
import { DepartmentListClient } from "@/components/manager/department-list-client";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listDepartmentsWithDetails } from "@/lib/services/departments";
import { listEmployees } from "@/lib/services/employees";

export default async function DepartmentsPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);

  const [departments, employees, t] = await Promise.all([
    listDepartmentsWithDetails(context),
    listEmployees(context),
    getServerDictionary(locale),
  ]);

  const managers = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
  }));

  const totalDepartments = departments.length;
  const totalMembers = departments.reduce((acc, d) => acc + d._count.employees, 0);
  const withoutManager = departments.filter((d) => !d.managerId).length;

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />

      <PageHeader
        action={<CreateDepartmentDialog managers={managers} />}
        breadcrumbs={[
          { label: t.common.navigation.dashboard, href: "/dashboard" },
          { label: t.departments.title },
        ]}
        description={t.departments.subtitle}
        title={t.departments.title}
      />

      <KpiGrid>
        <KpiCard
          icon={Building2}
          label={t.departments.totalDepartments}
          tone="violet"
          value={totalDepartments}
        />
        <KpiCard
          icon={Users}
          label={t.departments.totalMembers}
          tone="emerald"
          value={totalMembers}
        />
        <KpiCard
          icon={AlertCircle}
          label={t.departments.withoutManager}
          tone={withoutManager > 0 ? "amber" : "sky"}
          value={withoutManager}
        />
      </KpiGrid>

      <DepartmentListClient departments={departments} managers={managers} />
    </main>
  );
}

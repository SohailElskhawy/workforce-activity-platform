import { PageHeader } from "@/components/layout/page-header";
import { LeavesManagement } from "@/components/manager/leaves-management";
import { requireManager, toAuthContext } from "@/lib/auth";
import { listEmployees } from "@/lib/services/employees";
import { listEmployeeLeavesWithStore } from "@/lib/services/leaves";

export default async function LeavesPage() {
  const context = toAuthContext(await requireManager());
  const [employees, leaves] = await Promise.all([listEmployees(context), listEmployeeLeavesWithStore(context)]);
  return <main className="flex-1 space-y-6 p-6 md:p-10"><PageHeader title="Leave management" description="Manage employee leave records for this company." /><LeavesManagement employees={employees} leaves={leaves} /></main>;
}

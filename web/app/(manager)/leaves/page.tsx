import { PageHeader } from "@/components/layout/page-header";
import { LeavesManagement } from "@/components/manager/leaves-management";
import { requireManager, toAuthContext } from "@/lib/auth";
import { listEmployees } from "@/lib/services/employees";
import { listEmployeeLeavesWithStore } from "@/lib/services/leaves";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";

export default async function LeavesPage() {
  const [session, locale] = await Promise.all([requireManager(), getServerLocale()]);
  const context = toAuthContext(session);
  const [employees, leaves, t] = await Promise.all([listEmployees(context), listEmployeeLeavesWithStore(context), getServerDictionary(locale)]);
  return <main className="flex-1 space-y-6 p-6 md:p-10"><PageHeader title={t.hr.leaveManagement} description={t.hr.leaveManagementDesc} /><LeavesManagement employees={employees} leaves={leaves} /></main>;
}

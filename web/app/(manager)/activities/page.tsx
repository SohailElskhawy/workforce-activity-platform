import Link from "next/link";

import { PageHeading } from "@/components/manager/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { listEmployees } from "@/lib/services/employees";

export default async function ActivitiesPage() {
  const employees = await listEmployees(toAuthContext(await requireManager()));
  return <main className="flex-1 space-y-6 p-6 md:p-10"><PageHeading description="Open an employee to review their captured activity timeline and application time." title="Activities" /><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => <Card key={employee.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{employee.firstName} {employee.lastName}</CardTitle><CardDescription>{employee.department?.name ?? "Unassigned"}</CardDescription></div><Badge variant="outline">{employee.status}</Badge></div></CardHeader><CardContent><Link className="text-sm font-medium text-primary hover:underline" href={`/employees/${employee.id}`}>View activity timeline</Link></CardContent></Card>)}</section></main>;
}

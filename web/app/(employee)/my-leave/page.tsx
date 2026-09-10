import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { listOwnEmployeeLeavesWithStore } from "@/lib/services/leaves";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";

export default async function MyLeavePage() {
  const [session, locale] = await Promise.all([requireEmployee(), getServerLocale()]);
  const [leaves, t] = await Promise.all([listOwnEmployeeLeavesWithStore(toAuthContext(session)), getServerDictionary(locale)]);
  return <main className="flex-1 space-y-6 p-6 md:p-10"><PageHeader title={t.hr.myLeave} description={t.hr.myLeaveDesc} /><Card><CardContent className="pt-6">{leaves.length ? <ul className="space-y-3">{leaves.map((leave) => <li className="rounded-md border p-3 text-sm" key={leave.id}><strong>{leave.leaveType}</strong><p className="text-muted-foreground">{formatDate(leave.startDate, locale)} – {formatDate(leave.endDate, locale)} · {leave.status}</p>{leave.notes ? <p className="mt-1">{leave.notes}</p> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t.hr.noEmployeeLeaveRecords}</p>}</CardContent></Card></main>;
}

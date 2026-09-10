import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";

export function EmployeeLeavesCard({ leaves }: { leaves: Array<{ id: string; leaveType: string; startDate: Date; endDate: Date; status: string; notes: string | null }> }) {
  const { locale, t } = useI18n();
  return <Card><CardHeader><CardTitle>{t.hr.leaveInformation}</CardTitle><CardDescription>{t.hr.recentLeaveRecords}</CardDescription></CardHeader><CardContent>{leaves.length ? <ul className="space-y-3">{leaves.slice(0, 5).map((leave) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm" key={leave.id}><span><strong>{leave.leaveType}</strong><span className="ml-2 text-muted-foreground">{formatDate(leave.startDate, locale)} – {formatDate(leave.endDate, locale)}</span></span><StatusBadge value={leave.status} /></li>)}</ul> : <p className="text-sm text-muted-foreground">{t.hr.noEmployeeLeaveRecords}</p>}</CardContent></Card>;
}

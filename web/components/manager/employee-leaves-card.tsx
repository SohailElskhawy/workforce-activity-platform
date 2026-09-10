import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/formatters";

export function EmployeeLeavesCard({ leaves }: { leaves: Array<{ id: string; leaveType: string; startDate: Date; endDate: Date; status: string; notes: string | null }> }) {
  return <Card><CardHeader><CardTitle>Leave information</CardTitle><CardDescription>Recent leave records for this employee.</CardDescription></CardHeader><CardContent>{leaves.length ? <ul className="space-y-3">{leaves.slice(0, 5).map((leave) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm" key={leave.id}><span><strong>{leave.leaveType}</strong><span className="ml-2 text-muted-foreground">{formatDate(leave.startDate, "en")} – {formatDate(leave.endDate, "en")}</span></span><StatusBadge value={leave.status} /></li>)}</ul> : <p className="text-sm text-muted-foreground">No leave records.</p>}</CardContent></Card>;
}

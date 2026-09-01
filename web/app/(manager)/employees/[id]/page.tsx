import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ApplicationBreakdown } from "@/components/activity/application-breakdown";
import { ActivityPoller } from "@/components/activity/activity-poller";
import { PageHeading } from "@/components/manager/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { formatDurationFromMinutes, formatDurationFromSeconds } from "@/lib/formatters";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";

export default async function EmployeeDetailPage({ params }: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const summary = await getEmployeeDaySummary(toAuthContext(await requireManager()), id);
  const difference = summary.differenceMinutes === 0
    ? "Manual and activity time match"
    : `${formatDurationFromMinutes(Math.abs(summary.differenceMinutes))} ${summary.differenceMinutes > 0 ? "more manual time" : "more activity time"}`;

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeading description={`${summary.employee.department ?? "Unassigned department"} · ${summary.employee.position ?? "Employee"}`} title={summary.employee.name} action={<Badge variant={summary.employee.isOnline ? "default" : "secondary"}>{summary.employee.isOnline ? "Agent online" : "Agent offline"}</Badge>} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today's active" value={formatDurationFromSeconds(summary.activeSeconds)} />
        <MetricCard label="Today's idle" value={formatDurationFromSeconds(summary.idleSeconds)} />
        <MetricCard label="Manual time" value={formatDurationFromMinutes(summary.manualMinutes)} />
        <MetricCard label="Manual vs activity" value={difference} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2"><ApplicationBreakdown applications={summary.applications} /><Card><CardHeader><CardTitle>In-progress tasks</CardTitle><CardDescription>Current assigned project work.</CardDescription></CardHeader><CardContent>{summary.inProgressTasks.length ? <ul className="space-y-3 text-sm">{summary.inProgressTasks.map((task) => <li key={task.id}><p className="font-medium">{task.title}</p><p className="text-muted-foreground">{task.project.code} · {task.project.name}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No in-progress tasks.</p>}</CardContent></Card></section>
      <ActivityTimeline activities={summary.timeline} />
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-xl">{value}</CardTitle></CardHeader></Card>;
}

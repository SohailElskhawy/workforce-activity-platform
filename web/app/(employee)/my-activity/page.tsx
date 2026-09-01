import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ApplicationBreakdown } from "@/components/activity/application-breakdown";
import { ActivityPoller } from "@/components/activity/activity-poller";
import { PageHeading } from "@/components/manager/page-heading";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import { formatActivityDifference, formatDurationFromMinutes, formatDurationFromSeconds } from "@/lib/formatters";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";

export default async function MyActivityPage() {
  const context = toAuthContext(await requireEmployee());
  const summary = await getEmployeeDaySummary(context, context.employeeId!);
  return <main className="flex-1 space-y-6 p-6 md:p-10"><ActivityPoller /><PageHeading description="Your captured application activity for today." title="My Activity" /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active" value={formatDurationFromSeconds(summary.activeSeconds)} /><Metric label="Idle" value={formatDurationFromSeconds(summary.idleSeconds)} /><Metric label="Manual time" value={formatDurationFromMinutes(summary.manualMinutes)} /><Metric label="Manual vs activity" value={formatActivityDifference(summary.differenceMinutes)} /></section><ApplicationBreakdown applications={summary.applications} /><ActivityTimeline activities={summary.timeline} /></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-xl">{value}</CardTitle></CardHeader></Card>;
}

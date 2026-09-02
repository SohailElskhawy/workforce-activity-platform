import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ApplicationBreakdown } from "@/components/activity/application-breakdown";
import { ActivityPoller } from "@/components/activity/activity-poller";
import { PageHeading } from "@/components/manager/page-heading";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import {
  formatActivityDifference,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";

export default async function MyActivityPage() {
  const [session, locale] = await Promise.all([
    requireEmployee(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const [summary, t] = await Promise.all([
    getEmployeeDaySummary(context, context.employeeId!),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeading
        description={t.myActivity.subtitle}
        title={t.myActivity.title}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t.managerDashboard.active}
          value={formatDurationFromSeconds(summary.activeSeconds, locale)}
        />
        <Metric
          label={t.managerDashboard.idle}
          value={formatDurationFromSeconds(summary.idleSeconds, locale)}
        />
        <Metric
          label={t.myTime.title}
          value={formatDurationFromMinutes(summary.manualMinutes, locale)}
        />
        <Metric
          label={t.reports.manualVsTracked}
          value={formatActivityDifference(summary.differenceMinutes, locale)}
        />
      </section>
      <ApplicationBreakdown applications={summary.applications} />
      <ActivityTimeline activities={summary.timeline} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}


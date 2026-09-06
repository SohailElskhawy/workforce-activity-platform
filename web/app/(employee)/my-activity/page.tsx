import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ApplicationBreakdown } from "@/components/activity/application-breakdown";
import { ActivityPoller } from "@/components/activity/activity-poller";
import { DwgSummaryCard } from "@/components/activity/dwg-summary-card";
import { HistoricalDateFilter } from "@/components/activity/historical-date-filter";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { requireEmployee, toAuthContext } from "@/lib/auth";
import {
  formatActivityDifference,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";
import { formatDayString, parseSafeDate } from "@/lib/services/dwg-reports";

export default async function MyActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const [session, locale] = await Promise.all([
    requireEmployee(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);
  const resolvedSearchParams = await searchParams;
  const selectedDate = parseSafeDate(resolvedSearchParams?.day);
  const dayString = formatDayString(selectedDate);

  const [summary, t] = await Promise.all([
    getEmployeeDaySummary(context, context.employeeId!, selectedDate),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />
      <PageHeader
        action={<HistoricalDateFilter selectedDate={dayString} />}
        description={t.myActivity.subtitle}
        title={t.myActivity.title}
      />
      <KpiGrid>
        <KpiCard
          label={t.managerDashboard.active}
          tone="emerald"
          value={formatDurationFromSeconds(summary.activeSeconds, locale)}
        />
        <KpiCard
          label={t.managerDashboard.idle}
          tone="amber"
          value={formatDurationFromSeconds(summary.idleSeconds, locale)}
        />
        <KpiCard
          label={t.myTime.title}
          tone="sky"
          value={formatDurationFromMinutes(summary.manualMinutes, locale)}
        />
        <KpiCard
          label={t.reports.manualVsTracked}
          tone="violet"
          value={formatActivityDifference(summary.differenceMinutes, locale)}
        />
      </KpiGrid>
      <DwgSummaryCard items={summary.dwgSummary} />
      <ApplicationBreakdown applications={summary.applications} />
      <ActivityTimeline activities={summary.timeline} />
    </main>
  );
}



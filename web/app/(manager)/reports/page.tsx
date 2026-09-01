import Link from "next/link";

import { ReportTabs } from "@/components/activity/report-tabs";
import { PageHeading } from "@/components/manager/page-heading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { formatDurationFromSeconds } from "@/lib/formatters";
import { getManagerDashboardMetrics } from "@/lib/services/dashboard";

export default async function ReportsPage() {
  const metrics = await getManagerDashboardMetrics(toAuthContext(await requireManager()));
  return <main className="flex-1 space-y-6 p-6 md:p-10"><PageHeading description="Company-level activity metrics. Manual time and automated activity are intentionally reported separately." title="Reports" /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employees" value={String(metrics.employeeCount)} /><Metric label="Today's active time" value={formatDurationFromSeconds(metrics.activeSeconds)} /><Metric label="Today's idle time" value={formatDurationFromSeconds(metrics.idleSeconds)} /><Metric label="Overdue tasks" value={String(metrics.overdueTaskCount)} /></section><Card><CardHeader><CardTitle>Detailed reporting</CardTitle><CardDescription>Review automated activity without interpreting it as a productivity score.</CardDescription></CardHeader><CardContent><ReportTabs active={formatDurationFromSeconds(metrics.activeSeconds)} employees={String(metrics.employeeCount)} idle={formatDurationFromSeconds(metrics.idleSeconds)} overdue={String(metrics.overdueTaskCount)} /><Link className="mt-5 inline-block text-sm font-medium text-primary hover:underline" href="/activities">Open employee activity</Link></CardContent></Card></main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-xl">{value}</CardTitle></CardHeader></Card>; }

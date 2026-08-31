import { Activity, AlertTriangle, Clock3, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationFromSeconds } from "@/lib/formatters";
import { requireManager } from "@/lib/auth";
import { toAuthContext } from "@/lib/auth";
import { getManagerDashboardMetrics } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const session = await requireManager();
  const metrics = await getManagerDashboardMetrics(toAuthContext(session));
  const cards = [
    { label: "Employees", value: metrics.employeeCount, description: "People in your company", icon: Users },
    { label: "Today's active time", value: formatDurationFromSeconds(metrics.activeSeconds), description: "Application activity captured today", icon: Activity },
    { label: "Today's idle time", value: formatDurationFromSeconds(metrics.idleSeconds), description: "Idle periods captured today", icon: Clock3 },
    { label: "Overdue tasks", value: metrics.overdueTaskCount, description: "Open tasks past their due date", icon: AlertTriangle },
  ];

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">A live view of your company&apos;s current workload.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ description, icon: Icon, label, value }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
              </div>
              <Icon className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{description}</CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}

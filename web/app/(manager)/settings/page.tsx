import { Clock, RefreshCw, ShieldAlert } from "lucide-react";

import { ActivityPoller } from "@/components/activity/activity-poller";
import { PageHeader } from "@/components/layout/page-header";
import { AgentSyncCard } from "@/components/manager/agent-sync-card";
import { ExcludedAppsCard } from "@/components/manager/excluded-apps-card";
import { IdleThresholdCard } from "@/components/manager/idle-threshold-card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getCompanyTrackingSettings } from "@/lib/services/tracking-settings";

export default async function SettingsPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);

  const [trackingData, t] = await Promise.all([
    getCompanyTrackingSettings(context),
    getServerDictionary(locale),
  ]);

  const { settings, excludedApplications } = trackingData;

  const idleMinutesStr = `${(settings.idleThresholdSeconds / 60)
    .toFixed(1)
    .replace(/\.0$/, "")} ${t.settings.idleThresholdCard.minutesLabel}`;

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <ActivityPoller />

      <PageHeader
        breadcrumbs={[
          { label: t.common.navigation.dashboard, href: "/dashboard" },
          { label: t.settings.title },
        ]}
        description={t.settings.subtitle}
        title={t.settings.title}
      />

      <KpiGrid>
        <KpiCard
          icon={Clock}
          label={t.settings.idleThresholdCard.idleThresholdLabel}
          tone="sky"
          value={idleMinutesStr}
        />
        <KpiCard
          icon={ShieldAlert}
          label={t.settings.excludedAppsCard.title}
          tone="violet"
          value={excludedApplications.length}
        />
        <KpiCard
          icon={RefreshCw}
          label={t.settings.agentConfigCard.configVersionLabel}
          tone="emerald"
          value={`v${settings.configVersion}`}
        />
      </KpiGrid>

      <div className="grid gap-6">
        <IdleThresholdCard
          initialThresholdSeconds={settings.idleThresholdSeconds}
        />

        <ExcludedAppsCard
          excludedApplications={excludedApplications}
        />

        <AgentSyncCard
          configVersion={settings.configVersion}
          updatedAt={settings.updatedAt}
        />
      </div>
    </main>
  );
}

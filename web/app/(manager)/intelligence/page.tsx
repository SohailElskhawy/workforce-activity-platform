import { PageHeader } from "@/components/layout/page-header";
import { requireManagerContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import {
  generateExecutiveBriefing,
  getAutomaticClassification,
  getManagementRecommendations,
  getProjectPredictions,
  getWorkloadAnalysis,
} from "@/lib/services/analytics-engine";
import { IntelligenceDashboard } from "@/components/intelligence/intelligence-dashboard";

export default async function IntelligencePage() {
  const context = await requireManagerContext();
  const locale = await getServerLocale();
  const t = await getServerDictionary(locale);

  const [briefing, workload, predictions, classification, recommendations] =
    await Promise.all([
      generateExecutiveBriefing(context, "week"),
      getWorkloadAnalysis(context, { periodDays: 7 }),
      getProjectPredictions(context),
      getAutomaticClassification(context, { periodDays: 7 }),
      getManagementRecommendations(context),
    ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeader
        title={t.intelligence.title}
        description={t.intelligence.subtitle}
      />

      <IntelligenceDashboard
        initialBriefing={briefing}
        initialWorkload={workload}
        initialPredictions={predictions}
        initialClassification={classification}
        initialRecommendations={recommendations}
      />
    </main>
  );
}

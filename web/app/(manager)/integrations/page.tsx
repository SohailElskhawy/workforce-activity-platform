import { PageHeader } from "@/components/layout/page-header";
import { IntegrationsView } from "@/components/manager/integrations-view";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listCompanyIntegrationsWithStore } from "@/lib/services/integrations";

export default async function IntegrationsPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);

  const context = toAuthContext(session);

  const [integrations, t] = await Promise.all([
    listCompanyIntegrationsWithStore(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeader
        breadcrumbs={[
          { label: t.common.navigation.dashboard, href: "/dashboard" },
          { label: t.integrationsSection.title },
        ]}
        description={t.integrationsSection.subtitle}
        title={t.integrationsSection.title}
      />

      <IntegrationsView initialIntegrations={integrations} t={t} />
    </main>
  );
}

import { PageHeading } from "@/components/manager/page-heading";
import { AnomaliesUI, type AnomalyRow } from "@/components/anomalies/anomalies-ui";
import { requireManager, toAuthContext } from "@/lib/auth";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listAnomalies } from "@/lib/services/anomaly-detection";
import { listEmployees } from "@/lib/services/employees";

export default async function AnomaliesPage() {
  const [session, locale] = await Promise.all([
    requireManager(),
    getServerLocale(),
  ]);
  const context = toAuthContext(session);

  const [anomaliesData, employees, t] = await Promise.all([
    listAnomalies(context, { page: 1, pageSize: 50 }),
    listEmployees(context),
    getServerDictionary(locale),
  ]);

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <PageHeading
        title={t.anomalies.title}
        description={t.anomalies.subtitle}
      />
      <AnomaliesUI
        initialAnomalies={anomaliesData.items as unknown as AnomalyRow[]}
        initialKpis={anomaliesData.kpis}
        employees={employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
        }))}
      />
    </main>
  );
}

import { AdminIntegrations } from "@/components/admin/admin-ui";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; provider?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminIntegrations
      companyId={typeof params.companyId === "string" ? params.companyId : ""}
      provider={typeof params.provider === "string" ? params.provider : ""}
    />
  );
}

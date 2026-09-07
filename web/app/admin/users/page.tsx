import { AdminUsers } from "@/components/admin/admin-ui";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminUsers
      key={params.companyId ?? "all"}
      companyId={typeof params.companyId === "string" ? params.companyId : ""}
    />
  );
}

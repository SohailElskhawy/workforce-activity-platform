import { AdminCompany } from "@/components/admin/admin-ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminCompany id={(await params).id} />;
}

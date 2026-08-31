import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireManager } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await requireManager();
  return <DashboardPlaceholder email={session.user.email} role={session.user.role} title="Manager Dashboard" />;
}

import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireEmployee } from "@/lib/auth";

export default async function MyDashboardPage() {
  const session = await requireEmployee();
  return <DashboardPlaceholder email={session.user.email} role={session.user.role} title="My Dashboard" />;
}

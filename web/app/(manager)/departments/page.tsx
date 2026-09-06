import { ProtectedRoutePlaceholder } from "@/components/protected-route-placeholder";
import { requireManager } from "@/lib/auth";

export default async function DepartmentsPage() {
  await requireManager();
  return <ProtectedRoutePlaceholder title="Departments" />;
}

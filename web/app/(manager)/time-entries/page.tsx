import { ProtectedRoutePlaceholder } from "@/components/protected-route-placeholder";
import { requireManager } from "@/lib/auth";

export default async function TimeEntriesPage() {
  await requireManager();
  return <ProtectedRoutePlaceholder title="Time Entries" />;
}

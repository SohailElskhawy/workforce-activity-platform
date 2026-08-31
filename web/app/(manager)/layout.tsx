import { requireManager } from "@/lib/auth";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireManager();
  return children;
}

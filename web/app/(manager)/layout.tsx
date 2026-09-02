import { AppShell } from "@/components/layout/app-shell";
import { requireManager } from "@/lib/auth";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireManager();
  return (
    <AppShell email={session.user.email} role="MANAGER">
      {children}
    </AppShell>
  );
}

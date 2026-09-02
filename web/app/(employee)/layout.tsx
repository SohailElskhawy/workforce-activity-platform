import { AppShell } from "@/components/layout/app-shell";
import { requireEmployee } from "@/lib/auth";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireEmployee();
  return (
    <AppShell email={session.user.email} role="EMPLOYEE">
      {children}
    </AppShell>
  );
}

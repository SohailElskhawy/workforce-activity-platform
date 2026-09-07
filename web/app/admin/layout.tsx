import { AppShell } from "@/components/layout/app-shell";
import { requireSuperAdmin, getAuthSession } from "@/lib/auth";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  const session = await getAuthSession();
  return (
    <AppShell role="SUPER_ADMIN" email={session?.user.email}>
      {children}
    </AppShell>
  );
}

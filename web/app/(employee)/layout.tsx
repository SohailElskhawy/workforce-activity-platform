import { requireEmployee } from "@/lib/auth";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireEmployee();
  return children;
}

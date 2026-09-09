import type { UserRole } from "@/src/generated/prisma/enums";

export const DEMO_FIXTURE_SET = "worklens-client-demo";
export const DEMO_FIXTURE_VERSION = 1;
export const DEMO_PASSWORD = "Demo1234!";

export type DemoAccount = {
  role: Extract<UserRole, "SUPER_ADMIN" | "MANAGER" | "EMPLOYEE">;
  email: string;
  label: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: "SUPER_ADMIN",
    email: "admin@worklens.demo",
    label: "Super Admin",
  },
  { role: "MANAGER", email: "manager@worklens.demo", label: "Manager" },
  {
    role: "EMPLOYEE",
    email: "employee@worklens.demo",
    label: "Employee",
  },
];

export function isDemoModeEnabled(
  env?: { DEMO_MODE?: string | undefined },
) {
  const processDemoMode = (process.env as unknown as Record<
    string,
    string | undefined
  >).DEMO_MODE;
  return (env?.DEMO_MODE ?? processDemoMode) === "true";
}

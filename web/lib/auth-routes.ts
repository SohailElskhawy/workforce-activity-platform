import type { UserRole } from "@/src/generated/prisma/enums";

export const LOGIN_ROUTE = "/login";
export const MANAGER_HOME_ROUTE = "/dashboard";
export const EMPLOYEE_HOME_ROUTE = "/my-dashboard";

/** Returns the only role-specific homes available in the demo. */
export function getRoleHomeRoute(role: UserRole | undefined) {
  if (role === "MANAGER") return MANAGER_HOME_ROUTE;
  if (role === "EMPLOYEE") return EMPLOYEE_HOME_ROUTE;
  return null;
}

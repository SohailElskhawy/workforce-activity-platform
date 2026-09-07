import type { UserRole } from "@/src/generated/prisma/enums";

export const LOGIN_ROUTE = "/login";
export const MANAGER_HOME_ROUTE = "/dashboard";
export const EMPLOYEE_HOME_ROUTE = "/my-dashboard";

/** Role-specific application entry points. */
export function getRoleHomeRoute(role: UserRole | undefined) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "MANAGER") return MANAGER_HOME_ROUTE;
  if (role === "EMPLOYEE") return EMPLOYEE_HOME_ROUTE;
  return null;
}

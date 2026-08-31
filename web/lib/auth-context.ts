import type { UserRole } from "@/src/generated/prisma/enums";

import { ApiError } from "@/lib/http/errors";

export type AuthContext = {
  userId: string;
  companyId: string;
  role: UserRole;
  employeeId: string | null;
};

export function assertRole(
  context: Pick<AuthContext, "role">,
  allowedRoles: readonly UserRole[],
) {
  if (!allowedRoles.includes(context.role)) {
    throw new ApiError("FORBIDDEN", "You do not have access to this resource.", 403);
  }
}

/**
 * Adds an authenticated company scope to every company-owned Prisma query.
 * The trusted scope is written last so caller input cannot override it.
 */
export function tenantWhere<T extends object>(companyId: string, where: T) {
  return { ...where, companyId };
}

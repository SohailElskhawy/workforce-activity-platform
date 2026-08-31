import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export async function listEmployees(context: AuthContext) {
  return prisma.employee.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      position: true,
      status: true,
      department: { select: { name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

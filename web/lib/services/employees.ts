import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type AgentConnectionStatus = "NOT_ENROLLED" | "OFFLINE" | "ONLINE";

export function getAgentConnectionStatus(
  lastSeenAt: Date | null,
  now = new Date(),
): AgentConnectionStatus {
  if (!lastSeenAt) return "NOT_ENROLLED";
  return lastSeenAt.getTime() >= now.getTime() - 90_000 ? "ONLINE" : "OFFLINE";
}

export async function listEmployees(context: AuthContext) {
  const employees = await prisma.employee.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      position: true,
      status: true,
      department: { select: { name: true } },
      devices: {
        select: { lastSeenAt: true, name: true },
        orderBy: { lastSeenAt: "desc" },
        take: 1,
      },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return employees.map(({ devices, ...employee }) => {
    const device = devices[0] ?? null;
    return {
      ...employee,
      agentDeviceName: device?.name ?? null,
      agentStatus: getAgentConnectionStatus(device?.lastSeenAt ?? null),
    };
  });
}

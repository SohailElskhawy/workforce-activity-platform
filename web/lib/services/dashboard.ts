import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { ActivityType, TaskStatus } from "@/src/generated/prisma/enums";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function getManagerDashboardMetrics(context: AuthContext) {
  const companyId = context.companyId;
  const today = startOfToday();

  const [employeeCount, activeTime, idleTime, overdueTaskCount] = await Promise.all([
    prisma.employee.count({ where: tenantWhere(companyId, {}) }),
    prisma.activity.aggregate({
      where: tenantWhere(companyId, { type: ActivityType.APPLICATION, startAt: { gte: today } }),
      _sum: { durationSeconds: true },
    }),
    prisma.activity.aggregate({
      where: tenantWhere(companyId, { type: ActivityType.IDLE, startAt: { gte: today } }),
      _sum: { durationSeconds: true },
    }),
    prisma.task.count({
      where: tenantWhere(companyId, {
        dueDate: { lt: today },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      }),
    }),
  ]);

  return {
    employeeCount,
    activeSeconds: activeTime._sum?.durationSeconds ?? 0,
    idleSeconds: idleTime._sum?.durationSeconds ?? 0,
    overdueTaskCount,
  };
}

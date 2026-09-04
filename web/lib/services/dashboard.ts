import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { ActivityType, TaskStatus } from "@/src/generated/prisma/enums";

import { getZonedDayBounds } from "@/lib/time/timezone";

function startOfToday() {
  return getZonedDayBounds(new Date()).startAt;
}

export async function getManagerDashboardMetrics(context: AuthContext) {
  const companyId = context.companyId;
  const today = startOfToday();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const onlineCutoff = new Date(Date.now() - 90_000);

  const [
    employeeCount,
    activeTime,
    idleTime,
    overdueTaskCount,
    weekActiveTime,
    onlineDeviceCount,
  ] =
    await Promise.all([
      prisma.employee.count({ where: tenantWhere(companyId, {}) }),
      prisma.activity.aggregate({
        where: tenantWhere(companyId, {
          type: ActivityType.APPLICATION,
          startAt: { gte: today },
        }),
        _sum: { durationSeconds: true },
      }),
      prisma.activity.aggregate({
        where: tenantWhere(companyId, {
          type: ActivityType.IDLE,
          startAt: { gte: today },
        }),
        _sum: { durationSeconds: true },
      }),
      prisma.task.count({
        where: tenantWhere(companyId, {
          dueDate: { lt: today },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        }),
      }),
      prisma.activity.aggregate({
        where: tenantWhere(companyId, {
          type: ActivityType.APPLICATION,
          startAt: { gte: weekStart },
        }),
        _sum: { durationSeconds: true },
      }),
      prisma.device.count({
        where: tenantWhere(companyId, {
          isActive: true,
          lastSeenAt: { gte: onlineCutoff },
        }),
      }),
    ]);

  return {
    employeeCount,
    activeSeconds: activeTime._sum?.durationSeconds ?? 0,
    idleSeconds: idleTime._sum?.durationSeconds ?? 0,
    overdueTaskCount,
    weekActiveSeconds: weekActiveTime._sum?.durationSeconds ?? 0,
    onlineDeviceCount,
  };
}

export async function listRecentCompanyActivity(
  context: AuthContext,
  take = 6,
) {
  return prisma.activity.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      type: true,
      applicationName: true,
      fileName: true,
      durationSeconds: true,
      startAt: true,
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
      project: { select: { code: true } },
      task: { select: { title: true } },
    },
    orderBy: { startAt: "desc" },
    take: Math.min(Math.max(take, 1), 12),
  });
}

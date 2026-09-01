type ActivityForSummary = {
  type: "APPLICATION" | "IDLE" | "COMPUTER_LOCK" | "COMPUTER_UNLOCK" | "SYSTEM_START" | "SYSTEM_STOP";
  durationSeconds: number;
  applicationName: string | null;
};

export function manualActivityDifference(manualMinutes: number, activeSeconds: number) {
  return manualMinutes - Math.round(activeSeconds / 60);
}

export function assertEmployeeActivityScope(context: AuthContext, employeeId: string) {
  if (context.role === "EMPLOYEE" && context.employeeId !== employeeId) {
    throw new ApiError("FORBIDDEN", "You do not have access to this employee's activity.", 403);
  }
}

export function summarizeActivities(activities: ActivityForSummary[]) {
  const applications = new Map<string, number>();
  let activeSeconds = 0;
  let idleSeconds = 0;

  for (const activity of activities) {
    if (activity.type === "APPLICATION") {
      activeSeconds += activity.durationSeconds;
      const name = activity.applicationName?.trim() || "Other";
      applications.set(name, (applications.get(name) ?? 0) + activity.durationSeconds);
    }
    if (activity.type === "IDLE") idleSeconds += activity.durationSeconds;
  }

  return {
    activeSeconds,
    idleSeconds,
    applications: [...applications.entries()]
      .map(([name, durationSeconds]) => ({ name, durationSeconds }))
      .sort((left, right) => right.durationSeconds - left.durationSeconds || left.name.localeCompare(right.name)),
  };
}

function dayBounds(day: Date) {
  const startAt = new Date(day);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + 1);
  return { startAt, endAt };
}

export async function getEmployeeDaySummary(context: AuthContext, employeeId: string, day = new Date()) {
  assertEmployeeActivityScope(context, employeeId);
  const { prisma } = await import("@/lib/prisma");
  const { startAt, endAt } = dayBounds(day);

  const employee = await prisma.employee.findFirst({
    where: tenantWhere(context.companyId, { id: employeeId }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      position: true,
      status: true,
      department: { select: { name: true } },
      devices: { select: { lastSeenAt: true, name: true }, orderBy: { lastSeenAt: "desc" }, take: 1 },
      assignments: {
        where: { task: { status: "IN_PROGRESS" } },
        select: { task: { select: { id: true, title: true, project: { select: { id: true, name: true, code: true } } } } },
      },
    },
  });

  if (!employee) throw new ApiError("NOT_FOUND", "Employee not found.", 404);

  const [activities, manualTime] = await Promise.all([
    prisma.activity.findMany({
      where: tenantWhere(context.companyId, { employeeId, startAt: { gte: startAt, lt: endAt } }),
      select: {
        id: true, startAt: true, endAt: true, durationSeconds: true, type: true,
        applicationName: true, processName: true, windowTitle: true, fileName: true,
        project: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.timeEntry.aggregate({
      where: tenantWhere(context.companyId, { employeeId, startAt: { gte: startAt, lt: endAt } }),
      _sum: { durationMinutes: true },
    }),
  ]);

  const activityTotals = summarizeActivities(activities);
  const manualMinutes = manualTime._sum.durationMinutes ?? 0;
  const lastSeenAt = employee.devices[0]?.lastSeenAt ?? null;

  return {
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      position: employee.position,
      status: employee.status,
      department: employee.department?.name ?? null,
      device: employee.devices[0]?.name ?? null,
      lastSeenAt,
      isOnline: lastSeenAt ? lastSeenAt.getTime() >= Date.now() - 90_000 : false,
    },
    ...activityTotals,
    manualMinutes,
    differenceMinutes: manualActivityDifference(manualMinutes, activityTotals.activeSeconds),
    inProgressTasks: employee.assignments.map(({ task }) => task),
    timeline: activities,
  };
}
import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";

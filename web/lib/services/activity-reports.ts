import { aggregateDwgActivities, formatDayString } from "@/lib/services/dwg-reports";

type ActivityForSummary = {
  type:
    | "APPLICATION"
    | "IDLE"
    | "COMPUTER_LOCK"
    | "COMPUTER_UNLOCK"
    | "SYSTEM_START"
    | "SYSTEM_STOP";
  durationSeconds: number;
  applicationName: string | null;
};

export function manualActivityDifference(
  manualMinutes: number,
  activeSeconds: number,
) {
  return manualMinutes - Math.round(activeSeconds / 60);
}

export function assertEmployeeActivityScope(
  context: AuthContext,
  employeeId: string,
) {
  if (context.role === "EMPLOYEE" && context.employeeId !== employeeId) {
    throw new ApiError(
      "FORBIDDEN",
      "You do not have access to this employee's activity.",
      403,
    );
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
      applications.set(
        name,
        (applications.get(name) ?? 0) + activity.durationSeconds,
      );
    }
    if (activity.type === "IDLE") idleSeconds += activity.durationSeconds;
  }

  return {
    activeSeconds,
    idleSeconds,
    applications: [...applications.entries()]
      .map(([name, durationSeconds]) => ({ name, durationSeconds }))
      .sort(
        (left, right) =>
          right.durationSeconds - left.durationSeconds ||
          left.name.localeCompare(right.name),
      ),
  };
}

import { getZonedDayBounds } from "@/lib/time/timezone";

export async function getEmployeeDaySummary(
  context: AuthContext,
  employeeId: string,
  day: Date | string = new Date(),
) {
  assertEmployeeActivityScope(context, employeeId);
  const { prisma } = await import("@/lib/prisma");
  const { dayStr, startAt, endAt } = getZonedDayBounds(day);

  const employee = await prisma.employee.findFirst({
    where: tenantWhere(context.companyId, { id: employeeId }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      position: true,
      status: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      devices: {
        select: {
          id: true,
          deviceId: true,
          name: true,
          agentVersion: true,
          lastSeenAt: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { lastSeenAt: "desc" },
      },
      assignments: {
        where: { task: { status: "IN_PROGRESS" } },
        select: {
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
    },
  });

  if (!employee) throw new ApiError("NOT_FOUND", "Employee not found.", 404);

  const [activities, manualTimeEntries] = await Promise.all([
    prisma.activity.findMany({
      where: tenantWhere(context.companyId, {
        employeeId,
        startAt: { gte: startAt, lt: endAt },
      }),
      select: {
        id: true,
        startAt: true,
        endAt: true,
        durationSeconds: true,
        type: true,
        applicationName: true,
        processName: true,
        windowTitle: true,
        fileName: true,
        project: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: tenantWhere(context.companyId, {
        employeeId,
        startAt: { gte: startAt, lt: endAt },
      }),
      select: {
        id: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        notes: true,
        project: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const activityTotals = summarizeActivities(activities);
  const manualMinutes = manualTimeEntries.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );
  const activeDevice =
    employee.devices.find((d) => d.isActive) ?? employee.devices[0] ?? null;
  const lastSeenAt = activeDevice?.lastSeenAt ?? null;
  const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
  const dwgSummary = aggregateDwgActivities(
    activities.map((act) => ({
      employeeId: employee.id,
      employeeName,
      type: act.type,
      applicationName: act.applicationName,
      fileName: act.fileName,
      durationSeconds: act.durationSeconds,
      projectId: act.project?.id ?? null,
      projectName: act.project?.name ?? null,
      projectCode: act.project?.code ?? null,
      taskId: act.task?.id ?? null,
      taskTitle: act.task?.title ?? null,
    })),
  );

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      name: employeeName,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      status: employee.status,
      departmentId: employee.departmentId,
      department: employee.department?.name ?? null,
      device: activeDevice?.name ?? null,
      devices: employee.devices,
      lastSeenAt,
      isOnline: lastSeenAt
        ? lastSeenAt.getTime() >= Date.now() - 90_000
        : false,
    },
    ...activityTotals,
    manualMinutes,
    manualTimeEntries,
    differenceMinutes: manualActivityDifference(
      manualMinutes,
      activityTotals.activeSeconds,
    ),
    inProgressTasks: employee.assignments.map(({ task }) => task),
    timeline: activities,
    dwgSummary,
    selectedDate: dayStr,
  };
}

export async function getProjectActivitySummary(
  context: AuthContext,
  projectId: string,
) {
  const { prisma } = await import("@/lib/prisma");
  const project = await prisma.project.findFirst({
    where: tenantWhere(context.companyId, { id: projectId }),
    select: { id: true, name: true, code: true, estimatedHours: true },
  });
  if (!project) throw new ApiError("NOT_FOUND", "Project not found.", 404);
  const [activity, manual] = await Promise.all([
    prisma.activity.aggregate({
      where: tenantWhere(context.companyId, {
        projectId,
        type: "APPLICATION" as const,
      }),
      _sum: { durationSeconds: true },
    }),
    prisma.timeEntry.aggregate({
      where: tenantWhere(context.companyId, { projectId }),
      _sum: { durationMinutes: true },
    }),
  ]);
  const activeSeconds = activity._sum?.durationSeconds ?? 0;
  const manualMinutes = manual._sum.durationMinutes ?? 0;
  return {
    ...project,
    activeSeconds,
    manualMinutes,
    differenceMinutes: manualActivityDifference(manualMinutes, activeSeconds),
  };
}

export async function getTaskActivitySummary(
  context: AuthContext,
  taskId: string,
) {
  const { prisma } = await import("@/lib/prisma");
  const task = await prisma.task.findFirst({
    where: tenantWhere(context.companyId, { id: taskId }),
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      project: { select: { id: true, code: true, name: true } },
    },
  });
  if (!task) throw new ApiError("NOT_FOUND", "Task not found.", 404);
  const [activity, manual] = await Promise.all([
    prisma.activity.aggregate({
      where: tenantWhere(context.companyId, {
        taskId,
        type: "APPLICATION" as const,
      }),
      _sum: { durationSeconds: true },
    }),
    prisma.timeEntry.aggregate({
      where: tenantWhere(context.companyId, { taskId }),
      _sum: { durationMinutes: true },
    }),
  ]);
  const activeSeconds = activity._sum?.durationSeconds ?? 0;
  const manualMinutes = manual._sum.durationMinutes ?? 0;
  return {
    ...task,
    activeSeconds,
    manualMinutes,
    differenceMinutes: manualActivityDifference(manualMinutes, activeSeconds),
  };
}
import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";

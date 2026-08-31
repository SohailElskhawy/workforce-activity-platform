import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type { UpdateOwnTaskStatusInput } from "@/lib/validation/employee-tasks";
import { ActivityType, TaskStatus } from "@/src/generated/prisma/enums";

function requireEmployeeId(context: AuthContext) {
  if (!context.employeeId) {
    throw new ApiError("UNAUTHORIZED", "Employee access is required.", 401);
  }

  return context.employeeId;
}

export async function listOwnTasks(context: AuthContext) {
  const employeeId = requireEmployeeId(context);

  return prisma.taskAssignment.findMany({
    where: tenantWhere(context.companyId, { employeeId }),
    select: {
      id: true,
      assignedAt: true,
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          estimatedMinutes: true,
          dueDate: true,
          project: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export async function listOwnProjects(context: AuthContext) {
  const employeeId = requireEmployeeId(context);

  return prisma.project.findMany({
    where: tenantWhere(context.companyId, {
      tasks: { some: { assignments: { some: { employeeId } } } },
    }),
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      status: true,
      endDate: true,
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateOwnAssignedTaskStatus(
  context: AuthContext,
  taskId: string,
  input: UpdateOwnTaskStatusInput,
) {
  const employeeId = requireEmployeeId(context);

  return prisma.$transaction(async (transaction) => {
    const assignment = await transaction.taskAssignment.findFirst({
      where: tenantWhere(context.companyId, { employeeId, taskId }),
      select: { taskId: true },
    });

    if (!assignment) {
      throw new ApiError("NOT_FOUND", "Assigned task not found.", 404);
    }

    const task = await transaction.task.update({
      where: { id: assignment.taskId },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      },
      select: { id: true, status: true, completedAt: true },
    });

    await transaction.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: "TASK_STATUS_UPDATED_BY_EMPLOYEE",
        entityType: "Task",
        entityId: task.id,
        metadata: { status: task.status },
      },
    });

    return task;
  });
}

export async function getEmployeeDashboard(context: AuthContext) {
  const employeeId = requireEmployeeId(context);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [manualTime, assignedTaskCount, inProgressTaskCount, recentAssignments, activeTime, idleTime] =
    await Promise.all([
      prisma.timeEntry.aggregate({
        where: tenantWhere(context.companyId, { employeeId, startAt: { gte: today } }),
        _sum: { durationMinutes: true },
      }),
      prisma.taskAssignment.count({ where: tenantWhere(context.companyId, { employeeId }) }),
      prisma.taskAssignment.count({
        where: tenantWhere(context.companyId, {
          employeeId,
          task: { status: TaskStatus.IN_PROGRESS },
        }),
      }),
      prisma.taskAssignment.findMany({
        where: tenantWhere(context.companyId, { employeeId }),
        take: 5,
        select: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              project: { select: { code: true } },
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.activity.aggregate({
        where: tenantWhere(context.companyId, {
          employeeId,
          type: ActivityType.APPLICATION,
          startAt: { gte: today },
        }),
        _sum: { durationSeconds: true },
      }),
      prisma.activity.aggregate({
        where: tenantWhere(context.companyId, {
          employeeId,
          type: ActivityType.IDLE,
          startAt: { gte: today },
        }),
        _sum: { durationSeconds: true },
      }),
    ]);

  return {
    manualMinutes: manualTime._sum?.durationMinutes ?? 0,
    assignedTaskCount,
    inProgressTaskCount,
    recentTasks: recentAssignments.map(({ task }) => task),
    activeSeconds: activeTime._sum?.durationSeconds ?? 0,
    idleSeconds: idleTime._sum?.durationSeconds ?? 0,
  };
}

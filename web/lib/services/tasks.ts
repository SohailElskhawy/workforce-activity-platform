import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaErrorWithCode } from "@/lib/services/shared";
import {
  assertDueDateNotPast,
  type AssignEmployeeInput,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validation/tasks";

export async function listTasks(context: AuthContext) {
  return prisma.task.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      estimatedMinutes: true,
      project: { select: { id: true, name: true, code: true } },
      assignments: {
        select: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getTask(context: AuthContext, taskId: string) {
  const task = await prisma.task.findFirst({
    where: tenantWhere(context.companyId, { id: taskId }),
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      estimatedMinutes: true,
      project: { select: { id: true, name: true, code: true } },
      assignments: {
        select: {
          id: true,
          assignedAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
            },
          },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!task) {
    throw new ApiError("NOT_FOUND", "Task not found.", 404);
  }

  return task;
}

export async function createTask(context: AuthContext, input: CreateTaskInput) {
  assertDueDateNotPast(input.dueDate);

  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findFirst({
      where: tenantWhere(context.companyId, { id: input.projectId }),
      select: { id: true },
    });

    if (!project) {
      throw new ApiError("NOT_FOUND", "Project not found.", 404);
    }

    const task = await transaction.task.create({
      data: {
        ...input,
        companyId: context.companyId,
        createdById: context.userId,
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        status: true,
        priority: true,
      },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      metadata: { projectId: task.projectId },
    });

    return task;
  });
}

export async function assignEmployeeToTask(
  context: AuthContext,
  taskId: string,
  input: AssignEmployeeInput,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findFirst({
        where: tenantWhere(context.companyId, { id: taskId }),
        select: { id: true },
      });
      if (!task) {
        throw new ApiError("NOT_FOUND", "Task not found.", 404);
      }

      const employee = await transaction.employee.findFirst({
        where: tenantWhere(context.companyId, { id: input.employeeId }),
        select: { id: true },
      });
      if (!employee) {
        throw new ApiError("NOT_FOUND", "Employee not found.", 404);
      }

      const assignment = await transaction.taskAssignment.create({
        data: {
          companyId: context.companyId,
          taskId: task.id,
          employeeId: employee.id,
          assignedById: context.userId,
        },
        select: { id: true, taskId: true, employeeId: true, assignedAt: true },
      });

      await writeAudit(transaction, {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: "TASK_ASSIGNED",
        entityType: "TaskAssignment",
        entityId: assignment.id,
        metadata: { taskId: task.id, employeeId: employee.id },
      });

      return assignment;
    });
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      throw new ApiError(
        "CONFLICT",
        "This employee is already assigned to the task.",
        409,
      );
    }

    throw error;
  }
}

export async function updateTask(
  context: AuthContext,
  taskId: string,
  input: UpdateTaskInput,
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.task.findFirst({
      where: tenantWhere(context.companyId, { id: taskId }),
    });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Task not found.", 404);
    }

    if (input.dueDate !== undefined && input.dueDate !== null) {
      const incomingTime = new Date(input.dueDate).getTime();
      const existingTime = existing.dueDate
        ? new Date(existing.dueDate).getTime()
        : null;
      if (incomingTime !== existingTime) {
        assertDueDateNotPast(input.dueDate);
      }
    }

    let completedAt = existing.completedAt;
    if (input.status === "COMPLETED" && existing.status !== "COMPLETED") {
      completedAt = new Date();
    } else if (
      input.status &&
      input.status !== "COMPLETED" &&
      existing.status === "COMPLETED"
    ) {
      completedAt = null;
    }

    const updated = await transaction.task.update({
      where: { id: taskId },
      data: {
        ...input,
        completedAt,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedMinutes: true,
        completedAt: true,
      },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "TASK_UPDATED",
      entityType: "Task",
      entityId: updated.id,
      metadata: {
        changedFields: Object.keys(input).join(","),
        status: updated.status,
      },
    });

    return updated;
  });
}

export async function unassignEmployeeFromTask(
  context: AuthContext,
  taskId: string,
  employeeId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const task = await transaction.task.findFirst({
      where: tenantWhere(context.companyId, { id: taskId }),
      select: { id: true },
    });
    if (!task) {
      throw new ApiError("NOT_FOUND", "Task not found.", 404);
    }

    const assignment = await transaction.taskAssignment.findFirst({
      where: tenantWhere(context.companyId, { taskId, employeeId }),
      select: { id: true },
    });
    if (!assignment) {
      throw new ApiError("NOT_FOUND", "Task assignment not found.", 404);
    }

    await transaction.taskAssignment.delete({
      where: { id: assignment.id },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "TASK_UNASSIGNED",
      entityType: "TaskAssignment",
      entityId: assignment.id,
      metadata: { taskId, employeeId },
    });

    return { success: true };
  });
}


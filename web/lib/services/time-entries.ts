import "server-only";

import { assertRole, tenantWhere, type AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import {
  durationInMinutes,
  validateTimeEntryWindow,
} from "@/lib/services/time-rules";
import { getZonedDayBounds } from "@/lib/time/timezone";
import type {
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
} from "@/lib/validation/time-entries";

function requireEmployeeId(context: AuthContext) {
  if (!context.employeeId) {
    throw new ApiError("UNAUTHORIZED", "Employee access is required.", 401);
  }

  return context.employeeId;
}

export async function listOwnTimeEntries(context: AuthContext) {
  const employeeId = requireEmployeeId(context);

  return prisma.timeEntry.findMany({
    where: tenantWhere(context.companyId, { employeeId }),
    select: {
      id: true,
      projectId: true,
      taskId: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      notes: true,
      project: { select: { id: true, code: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { startAt: "desc" },
    take: 100,
  });
}

export async function createOwnTimeEntry(
  context: AuthContext,
  input: CreateTimeEntryInput,
) {
  const employeeId = requireEmployeeId(context);
  validateTimeEntryWindow(input.startAt, input.endAt);

  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findFirst({
      where: tenantWhere(context.companyId, { id: input.projectId }),
      select: { id: true },
    });
    if (!project) {
      throw new ApiError("NOT_FOUND", "Project not found.", 404);
    }

    if (input.taskId) {
      const task = await transaction.task.findFirst({
        where: tenantWhere(context.companyId, {
          id: input.taskId,
          projectId: project.id,
          assignments: { some: { employeeId } },
        }),
        select: { id: true },
      });
      if (!task) {
        throw new ApiError(
          "NOT_FOUND",
          "Assigned task not found for this project.",
          404,
        );
      }
    }

    const overlap = await transaction.timeEntry.findFirst({
      where: tenantWhere(context.companyId, {
        employeeId,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      }),
      select: { id: true },
    });
    if (overlap) {
      throw new ApiError(
        "CONFLICT",
        "This time entry overlaps an existing entry.",
        409,
      );
    }

    const entry = await transaction.timeEntry.create({
      data: {
        companyId: context.companyId,
        employeeId,
        projectId: project.id,
        taskId: input.taskId,
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: durationInMinutes(input.startAt, input.endAt),
        notes: input.notes,
      },
      select: { id: true, durationMinutes: true, endAt: true, startAt: true },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "TIME_ENTRY_CREATED",
      entityType: "TimeEntry",
      entityId: entry.id,
      metadata: {
        projectId: project.id,
        taskId: input.taskId ?? null,
        durationMinutes: entry.durationMinutes,
        startAt: entry.startAt.toISOString(),
        endAt: entry.endAt.toISOString(),
      },
    });

    return entry;
  });
}

export async function updateOwnTimeEntry(
  context: AuthContext,
  id: string,
  input: UpdateTimeEntryInput,
) {
  const employeeId = requireEmployeeId(context);
  validateTimeEntryWindow(input.startAt, input.endAt);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.timeEntry.findFirst({
      where: tenantWhere(context.companyId, { id, employeeId }),
      select: {
        id: true,
        projectId: true,
        taskId: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
      },
    });
    if (!existing) {
      throw new ApiError("NOT_FOUND", "Time entry not found.", 404);
    }

    const project = await transaction.project.findFirst({
      where: tenantWhere(context.companyId, { id: input.projectId }),
      select: { id: true },
    });
    if (!project) {
      throw new ApiError("NOT_FOUND", "Project not found.", 404);
    }

    if (input.taskId) {
      const task = await transaction.task.findFirst({
        where: tenantWhere(context.companyId, {
          id: input.taskId,
          projectId: project.id,
          assignments: { some: { employeeId } },
        }),
        select: { id: true },
      });
      if (!task) {
        throw new ApiError(
          "NOT_FOUND",
          "Assigned task not found for this project.",
          404,
        );
      }
    }

    const overlap = await transaction.timeEntry.findFirst({
      where: tenantWhere(context.companyId, {
        id: { not: id },
        employeeId,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      }),
      select: { id: true },
    });
    if (overlap) {
      throw new ApiError(
        "CONFLICT",
        "This time entry overlaps an existing entry.",
        409,
      );
    }

    const duration = durationInMinutes(input.startAt, input.endAt);
    const updated = await transaction.timeEntry.update({
      where: { id },
      data: {
        projectId: project.id,
        taskId: input.taskId ?? null,
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: duration,
        notes: input.notes,
      },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        durationMinutes: true,
        endAt: true,
        startAt: true,
        notes: true,
      },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "TIME_ENTRY_UPDATED",
      entityType: "TimeEntry",
      entityId: updated.id,
      metadata: {
        before: {
          startAt: existing.startAt.toISOString(),
          endAt: existing.endAt.toISOString(),
          durationMinutes: existing.durationMinutes,
          projectId: existing.projectId,
          taskId: existing.taskId,
        },
        after: {
          startAt: updated.startAt.toISOString(),
          endAt: updated.endAt.toISOString(),
          durationMinutes: updated.durationMinutes,
          projectId: updated.projectId,
          taskId: updated.taskId,
        },
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return updated;
  });
}

export async function deleteOwnTimeEntry(context: AuthContext, id: string) {
  const employeeId = requireEmployeeId(context);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.timeEntry.findFirst({
      where: tenantWhere(context.companyId, { id, employeeId }),
      select: {
        id: true,
        projectId: true,
        taskId: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
      },
    });
    if (!existing) {
      throw new ApiError("NOT_FOUND", "Time entry not found.", 404);
    }

    await transaction.timeEntry.delete({
      where: { id },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "TIME_ENTRY_DELETED",
      entityType: "TimeEntry",
      entityId: id,
      metadata: {
        projectId: existing.projectId,
        taskId: existing.taskId,
        durationMinutes: existing.durationMinutes,
        startAt: existing.startAt.toISOString(),
        endAt: existing.endAt.toISOString(),
      },
    });

    return { success: true };
  });
}

export type CompanyTimeEntryFilters = {
  date?: string;
  from?: string;
  to?: string;
  employeeId?: string;
  departmentId?: string;
  projectId?: string;
  taskId?: string;
};

export async function listCompanyTimeEntries(
  context: AuthContext,
  filters: CompanyTimeEntryFilters = {},
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const whereConditions: Record<string, unknown> = {};

  if (filters.employeeId) {
    whereConditions.employeeId = filters.employeeId;
  }

  if (filters.departmentId) {
    whereConditions.employee = { departmentId: filters.departmentId };
  }

  if (filters.projectId) {
    whereConditions.projectId = filters.projectId;
  }

  if (filters.taskId) {
    whereConditions.taskId = filters.taskId;
  }

  if (filters.date) {
    const { startAt, endAt } = getZonedDayBounds(filters.date);
    whereConditions.startAt = { gte: startAt, lt: endAt };
  } else if (filters.from || filters.to) {
    const dateRange: { gte?: Date; lt?: Date } = {};
    if (filters.from) {
      dateRange.gte = getZonedDayBounds(filters.from).startAt;
    }
    if (filters.to) {
      dateRange.lt = getZonedDayBounds(filters.to).endAt;
    }
    whereConditions.startAt = dateRange;
  }

  return prisma.timeEntry.findMany({
    where: tenantWhere(context.companyId, whereConditions),
    select: {
      id: true,
      projectId: true,
      taskId: true,
      employeeId: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      },
      project: { select: { id: true, code: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { startAt: "desc" },
    take: 200,
  });
}

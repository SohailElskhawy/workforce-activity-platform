import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaErrorWithCode } from "@/lib/services/shared";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/validation/projects";

export async function listProjects(context: AuthContext) {
  return prisma.project.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      name: true,
      code: true,
      clientName: true,
      status: true,
      endDate: true,
      estimatedHours: true,
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(context: AuthContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: tenantWhere(context.companyId, { id: projectId }),
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      clientName: true,
      status: true,
      startDate: true,
      endDate: true,
      estimatedHours: true,
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          estimatedMinutes: true,
          _count: { select: { assignments: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) {
    throw new ApiError("NOT_FOUND", "Project not found.", 404);
  }

  return project;
}

export async function createProject(
  context: AuthContext,
  input: CreateProjectInput,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const project = await transaction.project.create({
        data: {
          ...input,
          companyId: context.companyId,
          createdById: context.userId,
        },
        select: { id: true, name: true, code: true, status: true },
      });

      await writeAudit(transaction, {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
      });

      return project;
    });
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      throw new ApiError(
        "CONFLICT",
        "A project with this code already exists.",
        409,
      );
    }

    throw error;
  }
}

export async function updateProject(
  context: AuthContext,
  projectId: string,
  input: UpdateProjectInput,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.project.findFirst({
        where: tenantWhere(context.companyId, { id: projectId }),
      });

      if (!existing) {
        throw new ApiError("NOT_FOUND", "Project not found.", 404);
      }

      if (input.code && input.code !== existing.code) {
        const conflict = await transaction.project.findFirst({
          where: {
            companyId: context.companyId,
            code: input.code,
            id: { not: projectId },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ApiError(
            "CONFLICT",
            "A project with this code already exists.",
            409,
          );
        }
      }

      const effectiveStart =
        input.startDate !== undefined ? input.startDate : existing.startDate;
      const effectiveEnd =
        input.endDate !== undefined ? input.endDate : existing.endDate;
      if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "End date must be on or after the start date.",
          400,
        );
      }

      const updated = await transaction.project.update({
        where: { id: projectId },
        data: {
          ...input,
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          clientName: true,
          status: true,
          startDate: true,
          endDate: true,
          estimatedHours: true,
        },
      });

      await writeAudit(transaction, {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: "PROJECT_UPDATED",
        entityType: "Project",
        entityId: updated.id,
        metadata: {
          changedFields: Object.keys(input).join(","),
          status: updated.status,
        },
      });

      return updated;
    });
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      throw new ApiError(
        "CONFLICT",
        "A project with this code already exists.",
        409,
      );
    }
    throw error;
  }
}


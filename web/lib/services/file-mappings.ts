import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { normalizeFileName } from "@/lib/agent/file-name";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type { FileMappingInput } from "@/lib/validation/file-mappings";

export async function upsertFileMapping(context: AuthContext, input: FileMappingInput) {
  const project = await prisma.project.findFirst({ where: tenantWhere(context.companyId, { id: input.projectId }), select: { id: true } });
  if (!project) throw new ApiError("NOT_FOUND", "Project not found.", 404);
  if (input.taskId) {
    const task = await prisma.task.findFirst({ where: tenantWhere(context.companyId, { id: input.taskId, projectId: project.id }), select: { id: true } });
    if (!task) throw new ApiError("NOT_FOUND", "Task not found in this project.", 404);
  }
  const normalizedFileName = normalizeFileName(input.fileName);
  return prisma.$transaction(async (transaction) => {
    const mapping = await transaction.fileMapping.upsert({
      where: { companyId_normalizedFileName: { companyId: context.companyId, normalizedFileName } },
      create: { companyId: context.companyId, normalizedFileName, originalFileName: input.fileName, projectId: project.id, taskId: input.taskId ?? null, createdById: context.userId },
      update: { originalFileName: input.fileName, projectId: project.id, taskId: input.taskId ?? null },
      select: { id: true, originalFileName: true, projectId: true, taskId: true },
    });
    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "FILE_MAPPING_UPSERTED",
      entityType: "FileMapping",
      entityId: mapping.id,
    });
    return mapping;
  });
}

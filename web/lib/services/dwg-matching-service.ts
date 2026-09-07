import type { AuthContext } from "@/lib/auth-context";
import { assertRole, tenantWhere } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { normalizeFileName } from "@/lib/agent/file-name";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { ProjectStatus } from "@/src/generated/prisma/client";
import { getUnmappedDwgFiles } from "./dwg-reports";
import { matchDwgFile, type DwgMatchResult } from "./dwg-matcher";

export type DwgSuggestionItem = DwgMatchResult & {
  activeSeconds: number;
  employees: Array<{ id: string; name: string }>;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export async function getDwgMappingSuggestions(
  context: AuthContext,
  db = prisma,
): Promise<DwgSuggestionItem[]> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const [unmappedFiles, projects] = await Promise.all([
    getUnmappedDwgFiles(context, db),
    db.project.findMany({
      where: tenantWhere(context.companyId, {
        status: { not: ProjectStatus.ARCHIVED },
      }),
      select: {
        id: true,
        code: true,
        name: true,
        tasks: {
          select: { id: true, title: true },
        },
      },
    }),
  ]);

  if (!unmappedFiles.length || !projects.length) {
    return [];
  }

  const suggestions: DwgSuggestionItem[] = [];

  for (const file of unmappedFiles) {
    const match = matchDwgFile(file.fileName, projects);
    suggestions.push({
      ...match,
      activeSeconds: file.activeSeconds,
      employees: file.employees,
      firstSeenAt: file.firstSeenAt,
      lastSeenAt: file.lastSeenAt,
    });
  }

  // Sort suggestions: highest confidence first, then by active duration
  return suggestions.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.activeSeconds - a.activeSeconds ||
      a.fileName.localeCompare(b.fileName),
  );
}

export async function applyHighConfidenceDwgMatches(
  context: AuthContext,
  db = prisma,
): Promise<{ appliedCount: number; matchedFileNames: string[] }> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const suggestions = await getDwgMappingSuggestions(context, db);
  // Requirement 2: ONLY auto-apply 95-100% confidence unambiguous matches
  const highConfidenceMatches = suggestions.filter(
    (s) => s.autoAppliable && s.confidence >= 0.95 && s.matchedProject !== null,
  );

  if (!highConfidenceMatches.length) {
    return { appliedCount: 0, matchedFileNames: [] };
  }

  return db.$transaction(async (tx) => {
    let appliedCount = 0;
    const matchedFileNames: string[] = [];

    for (const match of highConfidenceMatches) {
      if (!match.matchedProject) continue;

      const normalizedFileName = normalizeFileName(match.fileName);

      // Requirement 1: Manual mapping always wins!
      // If a FileMapping already exists, skip it entirely.
      const existing = await tx.fileMapping.findUnique({
        where: {
          companyId_normalizedFileName: {
            companyId: context.companyId,
            normalizedFileName,
          },
        },
      });

      if (existing) {
        continue;
      }

      const mapping = await tx.fileMapping.create({
        data: {
          companyId: context.companyId,
          normalizedFileName,
          originalFileName: match.fileName,
          projectId: match.matchedProject.id,
          taskId: match.matchedTask?.id ?? null,
          source: "AUTO",
          createdById: context.userId,
        },
      });

      // Requirement 7: Retroactive activity mapping
      // Update ONLY unmapped (projectId: null) activity rows for the same company
      await tx.activity.updateMany({
        where: {
          companyId: context.companyId,
          projectId: null, // Never overwrite existing project/task assignments!
          OR: [
            { fileName: { equals: normalizedFileName, mode: "insensitive" } },
            { fileName: { equals: match.fileName, mode: "insensitive" } },
            {
              fileName: {
                endsWith: `\\${normalizedFileName}`,
                mode: "insensitive",
              },
            },
            {
              fileName: {
                endsWith: `/${normalizedFileName}`,
                mode: "insensitive",
              },
            },
            {
              fileName: {
                endsWith: `\\${match.fileName}`,
                mode: "insensitive",
              },
            },
            {
              fileName: {
                endsWith: `/${match.fileName}`,
                mode: "insensitive",
              },
            },
          ],
        },
        data: {
          projectId: match.matchedProject.id,
          taskId: match.matchedTask?.id ?? null,
        },
      });

      // Requirement 21: Audit FILE_MAPPING_AUTO_MATCHED
      await writeAudit(tx, {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: "FILE_MAPPING_AUTO_MATCHED",
        entityType: "FileMapping",
        entityId: mapping.id,
        metadata: {
          fileName: match.fileName,
          normalizedFileName,
          projectId: match.matchedProject.id,
          projectCode: match.matchedProject.code,
          taskId: match.matchedTask?.id ?? null,
          confidence: match.confidence,
          rule: match.rule,
          explanation: match.explanation,
        },
      });

      appliedCount++;
      matchedFileNames.push(match.fileName);
    }

    return { appliedCount, matchedFileNames };
  });
}

export async function acceptDwgSuggestion(
  context: AuthContext,
  input: {
    fileName: string;
    projectId: string;
    taskId?: string | null;
  },
  db = prisma,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const project = await db.project.findFirst({
    where: tenantWhere(context.companyId, { id: input.projectId }),
    select: { id: true, code: true, name: true },
  });
  if (!project) throw new ApiError("NOT_FOUND", "Project not found.", 404);

  if (input.taskId) {
    const task = await db.task.findFirst({
      where: tenantWhere(context.companyId, {
        id: input.taskId,
        projectId: project.id,
      }),
      select: { id: true, title: true },
    });
    if (!task)
      throw new ApiError("NOT_FOUND", "Task not found in this project.", 404);
  }

  const normalizedFileName = normalizeFileName(input.fileName);

  return db.$transaction(async (tx) => {
    // When a manager accepts/customizes a suggestion, it becomes MANUAL
    const mapping = await tx.fileMapping.upsert({
      where: {
        companyId_normalizedFileName: {
          companyId: context.companyId,
          normalizedFileName,
        },
      },
      create: {
        companyId: context.companyId,
        normalizedFileName,
        originalFileName: input.fileName,
        projectId: project.id,
        taskId: input.taskId ?? null,
        source: "MANUAL",
        createdById: context.userId,
      },
      update: {
        originalFileName: input.fileName,
        projectId: project.id,
        taskId: input.taskId ?? null,
        source: "MANUAL",
        createdById: context.userId,
      },
      select: {
        id: true,
        originalFileName: true,
        projectId: true,
        taskId: true,
        source: true,
      },
    });

    // Retroactive update on unmapped activities
    await tx.activity.updateMany({
      where: {
        companyId: context.companyId,
        projectId: null,
        OR: [
          { fileName: { equals: normalizedFileName, mode: "insensitive" } },
          { fileName: { equals: input.fileName, mode: "insensitive" } },
          {
            fileName: {
              endsWith: `\\${normalizedFileName}`,
              mode: "insensitive",
            },
          },
          {
            fileName: {
              endsWith: `/${normalizedFileName}`,
              mode: "insensitive",
            },
          },
          {
            fileName: {
              endsWith: `\\${input.fileName}`,
              mode: "insensitive",
            },
          },
          {
            fileName: {
              endsWith: `/${input.fileName}`,
              mode: "insensitive",
            },
          },
        ],
      },
      data: {
        projectId: project.id,
        taskId: input.taskId ?? null,
      },
    });

    // Requirement 21: Audit FILE_MAPPING_SUGGESTION_ACCEPTED
    await writeAudit(tx, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "FILE_MAPPING_SUGGESTION_ACCEPTED",
      entityType: "FileMapping",
      entityId: mapping.id,
      metadata: {
        fileName: input.fileName,
        normalizedFileName,
        projectId: project.id,
        projectCode: project.code,
        taskId: input.taskId ?? null,
      },
    });

    return mapping;
  });
}

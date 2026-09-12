import type { AuthenticatedDevice } from "@/lib/agent/authenticate";
import { normalizeFileName } from "@/lib/agent/file-name";
import type { AgentActivityInput } from "@/lib/agent/schemas";
import { ApiError } from "@/lib/http/errors";
import { matchDwgFile, type ProjectCandidate } from "./dwg-matcher";

type ActivityCreateInput = {
  eventId: string;
  companyId: string;
  employeeId: string;
  deviceId: string;
  projectId: string | null;
  taskId: string | null;
  startAt: Date;
  endAt: Date;
  durationSeconds: number;
  applicationName: string | null;
  processName: string | null;
  windowTitle: string | null;
  fileName: string | null;
  type: AgentActivityInput["type"];
};

export type AgentActivityStore = {
  findFileMapping(
    companyId: string,
    normalizedFileName: string,
  ): Promise<{ projectId: string; taskId: string | null } | null>;
  createActivity(data: ActivityCreateInput): Promise<"created" | "duplicate">;
  createActivities?(data: ActivityCreateInput[]): Promise<{ created: number }>;
  findCandidateProjects?(companyId: string): Promise<ProjectCandidate[]>;
  createAutoFileMapping?(data: {
    companyId: string;
    normalizedFileName: string;
    originalFileName: string;
    projectId: string;
    taskId: string | null;
    source: "AUTO";
  }): Promise<void>;
};

type ActivityPrismaClient = {
  activity: {
    createMany(input: {
      data: ActivityCreateInput[];
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
  fileMapping: {
    findUnique(input: {
      where: {
        companyId_normalizedFileName: {
          companyId: string;
          normalizedFileName: string;
        };
      };
      select: { projectId: true; taskId: true };
    }): Promise<{ projectId: string; taskId: string | null } | null>;
    upsert?(input: {
      where: {
        companyId_normalizedFileName: {
          companyId: string;
          normalizedFileName: string;
        };
      };
      create: {
        companyId: string;
        normalizedFileName: string;
        originalFileName: string;
        projectId: string;
        taskId: string | null;
        source: "AUTO";
      };
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  project?: {
    findMany(input: {
      where: { companyId: string; status: { not: string } };
      select: {
        id: true;
        code: true;
        name: true;
        tasks: { select: { id: true; title: true } };
      };
    }): Promise<ProjectCandidate[]>;
  };
};

function validateDuration(startAt: Date, endAt: Date) {
  const durationSeconds = Math.floor(
    (endAt.getTime() - startAt.getTime()) / 1_000,
  );
  if (durationSeconds <= 0 || durationSeconds > 21_600) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Activity duration must be between 1 second and 6 hours.",
      400,
    );
  }
  return durationSeconds;
}

async function ingestWithStore(
  device: AuthenticatedDevice,
  activities: AgentActivityInput[],
  store: AgentActivityStore,
) {
  let candidatesCache: ProjectCandidate[] | null = null;
  const activityRows: ActivityCreateInput[] = [];
  const mappingCache = new Map<
    string,
    { projectId: string; taskId: string | null } | null
  >();

  for (const event of activities) {
    const durationSeconds = validateDuration(event.startAt, event.endAt);
    const normalizedFileName = event.fileName
      ? normalizeFileName(event.fileName)
      : null;
    let mapping: { projectId: string; taskId: string | null } | null = null;
    if (normalizedFileName) {
      if (mappingCache.has(normalizedFileName)) {
        mapping = mappingCache.get(normalizedFileName) ?? null;
      } else {
        mapping = await store.findFileMapping(
          device.companyId,
          normalizedFileName,
        );
        mappingCache.set(normalizedFileName, mapping);
      }
    }

    // Requirement 8: Ingestion-time matching for safe exact unique match (confidence >= 0.95)
    if (
      !mapping &&
      event.fileName &&
      normalizedFileName?.endsWith(".dwg") &&
      store.findCandidateProjects &&
      store.createAutoFileMapping
    ) {
      if (candidatesCache === null) {
        candidatesCache = await store.findCandidateProjects(device.companyId);
      }
      const match = matchDwgFile(event.fileName, candidatesCache);
      if (
        match.autoAppliable &&
        match.confidence >= 0.95 &&
        !match.ambiguous &&
        match.matchedProject
      ) {
        mapping = {
          projectId: match.matchedProject.id,
          taskId: match.matchedTask?.id ?? null,
        };
        mappingCache.set(normalizedFileName, mapping);
        await store.createAutoFileMapping({
          companyId: device.companyId,
          normalizedFileName,
          originalFileName: event.fileName,
          projectId: match.matchedProject.id,
          taskId: match.matchedTask?.id ?? null,
          source: "AUTO",
        });
      }
    }

    activityRows.push({
      applicationName: event.applicationName ?? null,
      companyId: device.companyId,
      deviceId: device.databaseId,
      durationSeconds,
      employeeId: device.employeeId,
      endAt: event.endAt,
      eventId: event.eventId,
      fileName: event.fileName ?? null,
      processName: event.processName ?? null,
      projectId: mapping?.projectId ?? null,
      startAt: event.startAt,
      taskId: mapping?.taskId ?? null,
      type: event.type,
      windowTitle: event.windowTitle ?? null,
    });
  }

  if (store.createActivities) {
    await store.createActivities(activityRows);
  } else {
    for (const row of activityRows) await store.createActivity(row);
  }

  return { accepted: activities.length };
}

export function createConflictSafeActivityStore(
  client: ActivityPrismaClient,
): AgentActivityStore {
  return {
    async createActivity(data) {
      const result = await client.activity.createMany({
        data: [data],
        skipDuplicates: true,
      });
      return result.count === 0 ? "duplicate" : "created";
    },
    async createActivities(data) {
      const result = await client.activity.createMany({
        data,
        skipDuplicates: true,
      });
      return { created: result.count };
    },
    async findFileMapping(companyId, normalizedFileName) {
      return client.fileMapping.findUnique({
        where: {
          companyId_normalizedFileName: { companyId, normalizedFileName },
        },
        select: { projectId: true, taskId: true },
      });
    },
    async findCandidateProjects(companyId) {
      if (!client.project?.findMany) return [];
      return client.project.findMany({
        where: { companyId, status: { not: "ARCHIVED" } },
        select: {
          id: true,
          code: true,
          name: true,
          tasks: { select: { id: true, title: true } },
        },
      });
    },
    async createAutoFileMapping(data) {
      if (!client.fileMapping?.upsert) return;
      await client.fileMapping.upsert({
        where: {
          companyId_normalizedFileName: {
            companyId: data.companyId,
            normalizedFileName: data.normalizedFileName,
          },
        },
        create: data,
        update: {}, // Never overwrite existing mapping on race condition
      });
    },
  };
}

async function createPrismaStore(): Promise<AgentActivityStore> {
  const { prisma } = await import("@/lib/prisma");
  return createConflictSafeActivityStore({
    activity: prisma.activity as unknown as ActivityPrismaClient["activity"],
    fileMapping:
      prisma.fileMapping as unknown as ActivityPrismaClient["fileMapping"],
    project: prisma.project as unknown as ActivityPrismaClient["project"],
  });
}

export async function ingestActivityBatch(
  device: AuthenticatedDevice,
  activities: AgentActivityInput[],
  store?: AgentActivityStore,
) {
  if (store) return ingestWithStore(device, activities, store);

  const prismaStore = await createPrismaStore();
  return ingestWithStore(device, activities, prismaStore);
}

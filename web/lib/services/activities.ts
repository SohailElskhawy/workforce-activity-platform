import type { AuthenticatedDevice } from "@/lib/agent/authenticate";
import { normalizeFileName } from "@/lib/agent/file-name";
import type { AgentActivityInput } from "@/lib/agent/schemas";
import { ApiError } from "@/lib/http/errors";

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
  findFileMapping(companyId: string, normalizedFileName: string): Promise<{ projectId: string; taskId: string | null } | null>;
  createActivity(data: ActivityCreateInput): Promise<"created" | "duplicate">;
};

type ActivityPrismaClient = {
  activity: {
    createMany(input: { data: ActivityCreateInput[]; skipDuplicates: boolean }): Promise<{ count: number }>;
  };
  fileMapping: {
    findUnique(input: {
      where: { companyId_normalizedFileName: { companyId: string; normalizedFileName: string } };
      select: { projectId: true; taskId: true };
    }): Promise<{ projectId: string; taskId: string | null } | null>;
  };
};

function validateDuration(startAt: Date, endAt: Date) {
  const durationSeconds = Math.floor((endAt.getTime() - startAt.getTime()) / 1_000);
  if (durationSeconds <= 0 || durationSeconds > 21_600) {
    throw new ApiError("VALIDATION_ERROR", "Activity duration must be between 1 second and 6 hours.", 400);
  }
  return durationSeconds;
}

async function ingestWithStore(device: AuthenticatedDevice, activities: AgentActivityInput[], store: AgentActivityStore) {
  for (const event of activities) {
    const durationSeconds = validateDuration(event.startAt, event.endAt);
    const normalizedFileName = event.fileName ? normalizeFileName(event.fileName) : null;
    const mapping = normalizedFileName ? await store.findFileMapping(device.companyId, normalizedFileName) : null;

    await store.createActivity({
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

  return { accepted: activities.length };
}

export function createConflictSafeActivityStore(client: ActivityPrismaClient): AgentActivityStore {
  return {
    async createActivity(data) {
      const result = await client.activity.createMany({ data: [data], skipDuplicates: true });
      return result.count === 0 ? "duplicate" : "created";
    },
    async findFileMapping(companyId, normalizedFileName) {
      return client.fileMapping.findUnique({
        where: { companyId_normalizedFileName: { companyId, normalizedFileName } },
        select: { projectId: true, taskId: true },
      });
    },
  };
}

async function createPrismaStore(): Promise<{ run<T>(operation: (store: AgentActivityStore) => Promise<T>): Promise<T> }> {
  const { prisma } = await import("@/lib/prisma");

  return {
    async run<T>(operation: (store: AgentActivityStore) => Promise<T>) {
      return prisma.$transaction(async (transaction) =>
        operation(createConflictSafeActivityStore({
          activity: transaction.activity as unknown as ActivityPrismaClient["activity"],
          fileMapping: transaction.fileMapping as unknown as ActivityPrismaClient["fileMapping"],
        })),
      );
    },
  };
}

export async function ingestActivityBatch(
  device: AuthenticatedDevice,
  activities: AgentActivityInput[],
  store?: AgentActivityStore,
) {
  if (store) return ingestWithStore(device, activities, store);

  const prismaStore = await createPrismaStore();
  return prismaStore.run((transactionStore) => ingestWithStore(device, activities, transactionStore));
}

import { assertRole, type AuthContext } from "@/lib/auth-context";
import { decryptJson } from "@/lib/crypto/secret";
import { prisma } from "@/lib/prisma";
import type {
  ClockifyClient,
  ClockifyTimeEntry,
} from "@/lib/integrations/clockify/client";
import { ClockifyClient as DefaultClockifyClient } from "@/lib/integrations/clockify/client";
import type {
  IntegrationMappingRecord,
  IntegrationRecord,
} from "@/lib/services/integrations";
import { defaultIntegrationStore } from "@/lib/services/integrations";
import type { Prisma } from "@/src/generated/prisma/client";

export type ClockifyImportResult = {
  totalFound: number;
  imported: number;
  skippedDuplicate: number;
  unmapped: number;
  unmappedUser: number;
  unmappedProject: number;
  failed: number;
  errors: string[];
};

export type ClockifyImportDatabase = {
  findIntegration(companyId: string): Promise<IntegrationRecord | null>;
  findMapping(
    companyId: string,
    externalType: string,
    externalId: string
  ): Promise<IntegrationMappingRecord | null>;
  upsertMapping(
    companyId: string,
    externalType: string,
    externalId: string,
    internalType: string,
    internalId: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<IntegrationMappingRecord>;
  findEmployeeByEmail(
    companyId: string,
    email: string
  ): Promise<{ id: string; email: string } | null>;
  findProjectByName(
    companyId: string,
    name: string
  ): Promise<{ id: string; name: string } | null>;
  findTimeEntryByExternalId(
    companyId: string,
    externalId: string
  ): Promise<{ id: string } | null>;
  createTimeEntry(data: {
    companyId: string;
    employeeId: string;
    projectId: string;
    taskId?: string | null;
    startAt: Date;
    endAt: Date;
    durationMinutes: number;
    notes?: string | null;
    source: string;
    externalId: string;
  }): Promise<{ id: string }>;
  recordSyncStatus(
    companyId: string,
    status: string,
    error?: string | null
  ): Promise<void>;
};

export const defaultClockifyDatabase: ClockifyImportDatabase = {
  async findIntegration(companyId) {
    return defaultIntegrationStore.findIntegration(companyId, "CLOCKIFY");
  },
  async findMapping(companyId, externalType, externalId) {
    return defaultIntegrationStore.findMapping(
      companyId,
      "CLOCKIFY",
      externalType,
      externalId
    );
  },
  async upsertMapping(
    companyId,
    externalType,
    externalId,
    internalType,
    internalId,
    metadata
  ) {
    return defaultIntegrationStore.upsertMapping(
      companyId,
      "CLOCKIFY",
      externalType,
      externalId,
      internalType,
      internalId,
      metadata
    );
  },
  async findEmployeeByEmail(companyId, email) {
    return prisma.employee.findFirst({
      where: {
        companyId,
        email: { equals: email.toLowerCase(), mode: "insensitive" },
      },
      select: { id: true, email: true },
    });
  },
  async findProjectByName(companyId, name) {
    return prisma.project.findFirst({
      where: {
        companyId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });
  },
  async findTimeEntryByExternalId(companyId, externalId) {
    return prisma.timeEntry.findFirst({
      where: {
        companyId,
        source: "CLOCKIFY",
        externalId,
      },
      select: { id: true },
    });
  },
  async createTimeEntry(data) {
    return prisma.timeEntry.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        projectId: data.projectId,
        taskId: data.taskId ?? null,
        startAt: data.startAt,
        endAt: data.endAt,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
        source: data.source,
        externalId: data.externalId,
      },
      select: { id: true },
    });
  },
  async recordSyncStatus(companyId, status, error) {
    await defaultIntegrationStore.upsertIntegration(companyId, "CLOCKIFY", {
      status: status as any,
      lastSyncAt: new Date(),
      lastError: error,
    });
  },
};

export async function importClockifyHistoricalTime(
  context: AuthContext,
  params: {
    workspaceId: string;
    startDate: string;
    endDate: string;
    client?: ClockifyClient;
    db?: ClockifyImportDatabase;
  }
): Promise<ClockifyImportResult> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);
  const db = params.db ?? defaultClockifyDatabase;

  const integration = await db.findIntegration(context.companyId);
  if (!integration || !integration.encryptedCredentials) {
    throw new Error("Clockify integration is not configured");
  }

  const { apiKey } = decryptJson<{ apiKey: string }>(
    integration.encryptedCredentials
  );

  const client = params.client ?? new DefaultClockifyClient({ apiKey });

  const result: ClockifyImportResult = {
    totalFound: 0,
    imported: 0,
    skippedDuplicate: 0,
    unmapped: 0,
    unmappedUser: 0,
    unmappedProject: 0,
    failed: 0,
    errors: [],
  };

  // 1. Fetch users and map to employees
  const clockifyUsers = await client.getUsers(params.workspaceId);
  const userMap = new Map<string, string>(); // clockifyUserId -> employeeId

  for (const cu of clockifyUsers) {
    const existingMapping = await db.findMapping(
      context.companyId,
      "USER",
      cu.id
    );
    if (existingMapping) {
      userMap.set(cu.id, existingMapping.internalId);
      continue;
    }

    if (cu.email) {
      const emp = await db.findEmployeeByEmail(context.companyId, cu.email);
      if (emp) {
        userMap.set(cu.id, emp.id);
        await db.upsertMapping(
          context.companyId,
          "USER",
          cu.id,
          "Employee",
          emp.id,
          { email: cu.email, name: cu.name } as Prisma.InputJsonValue
        );
      }
    }
  }

  // 2. Fetch projects and map
  const clockifyProjects = await client.getProjects(params.workspaceId, 1, 100);
  const projectMap = new Map<string, string>(); // clockifyProjectId -> projectId

  for (const cp of clockifyProjects) {
    const existingMapping = await db.findMapping(
      context.companyId,
      "PROJECT",
      cp.id
    );
    if (existingMapping) {
      projectMap.set(cp.id, existingMapping.internalId);
      continue;
    }

    const matchedProject = await db.findProjectByName(
      context.companyId,
      cp.name
    );
    if (matchedProject) {
      projectMap.set(cp.id, matchedProject.id);
      await db.upsertMapping(
        context.companyId,
        "PROJECT",
        cp.id,
        "Project",
        matchedProject.id,
        { name: cp.name } as Prisma.InputJsonValue
      );
    }
  }

  // 3. Fetch time entries with pagination
  let page = 1;
  let hasMore = true;
  const pageSize = 50;

  while (hasMore && page <= 20) {
    let entries: ClockifyTimeEntry[] = [];
    try {
      entries = await client.getTimeEntries(params.workspaceId, {
        start: params.startDate,
        end: params.endDate,
        page,
        pageSize,
      });
    } catch (fetchErr) {
      result.errors.push(
        `Page ${page} fetch error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
      );
      break;
    }

    if (!entries || entries.length === 0) {
      hasMore = false;
      break;
    }

    result.totalFound += entries.length;

    for (const entry of entries) {
      try {
        if (!entry.timeInterval?.start || !entry.timeInterval?.end) {
          // Skip entries that are active / not completed
          continue;
        }

        // Idempotency check: does this external entry already exist?
        const existingEntry = await db.findTimeEntryByExternalId(
          context.companyId,
          entry.id
        );
        if (existingEntry) {
          result.skippedDuplicate++;
          continue;
        }

        // Map employee
        const employeeId = userMap.get(entry.userId);
        if (!employeeId) {
          result.unmapped++;
          result.unmappedUser++;
          result.errors.push(
            `Entry ${entry.id}: Clockify user ${entry.userId} is not mapped to any WorkLens employee`
          );
          continue;
        }

        // Map project - do NOT silently attribute to unrelated/default project!
        const projectId = entry.projectId ? projectMap.get(entry.projectId) : undefined;
        if (!projectId) {
          result.unmapped++;
          result.unmappedProject++;
          result.errors.push(
            `Entry ${entry.id}: Clockify project ${entry.projectId || "unspecified"} is not mapped to any WorkLens project`
          );
          continue;
        }

        const startAt = new Date(entry.timeInterval.start);
        const endAt = new Date(entry.timeInterval.end);
        const durationMinutes = Math.max(
          1,
          Math.round((endAt.getTime() - startAt.getTime()) / 60000)
        );

        const created = await db.createTimeEntry({
          companyId: context.companyId,
          employeeId,
          projectId,
          taskId: null,
          startAt,
          endAt,
          durationMinutes,
          notes: entry.description || "Imported from Clockify",
          source: "CLOCKIFY",
          externalId: entry.id,
        });

        await db.upsertMapping(
          context.companyId,
          "TIME_ENTRY",
          entry.id,
          "TimeEntry",
          created.id,
          {
            start: entry.timeInterval.start,
            end: entry.timeInterval.end,
            importedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue
        );

        result.imported++;
      } catch (entryErr) {
        result.failed++;
        result.errors.push(
          `Entry ${entry.id}: ${entryErr instanceof Error ? entryErr.message : String(entryErr)}`
        );
      }
    }

    if (entries.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // Update integration lastSyncAt and status
  await db.recordSyncStatus(
    context.companyId,
    "CONNECTED",
    result.errors.length > 0
      ? `${result.imported} imported, ${result.errors.length} warnings`
      : null
  );

  return result;
}

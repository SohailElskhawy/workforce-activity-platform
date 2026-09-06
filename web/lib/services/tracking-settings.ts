import { assertRole, tenantWhere, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditMetadata } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type {
  AddExcludedApplicationInput,
  UpdateExcludedApplicationInput,
  UpdateTrackingSettingsInput,
} from "@/lib/validation/tracking-settings";

export type TrackingSettingsStore = {
  getSettings(companyId: string): Promise<{
    id: string;
    companyId: string;
    idleThresholdSeconds: number;
    configVersion: number;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  saveSettings(settings: {
    id: string;
    companyId: string;
    idleThresholdSeconds: number;
    configVersion: number;
  }): Promise<{
    id: string;
    companyId: string;
    idleThresholdSeconds: number;
    configVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  findExclusionById(
    id: string,
    companyId: string,
  ): Promise<{
    id: string;
    companyId: string;
    processName: string;
    displayName: string | null;
  } | null>;
  findExclusionByProcess(
    processName: string,
    companyId: string,
  ): Promise<{ id: string } | null>;
  listExclusions(companyId: string): Promise<
    Array<{
      id: string;
      companyId: string;
      processName: string;
      displayName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >;
  createExclusion(data: {
    companyId: string;
    processName: string;
    displayName: string | null;
  }): Promise<{
    id: string;
    companyId: string;
    processName: string;
    displayName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  updateExclusion(
    id: string,
    data: { displayName: string | null },
  ): Promise<{
    id: string;
    companyId: string;
    processName: string;
    displayName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  deleteExclusion(id: string): Promise<void>;
  writeAudit(entry: {
    action: string;
    entityType: string;
    entityId: string;
    metadata?: AuditMetadata;
  }): Promise<void>;
};

export async function getCompanyTrackingSettingsWithStore(
  context: AuthContext,
  store: TrackingSettingsStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  let settings = await store.getSettings(context.companyId);
  if (!settings) {
    settings = await store.saveSettings({
      id: `settings-${context.companyId}`,
      companyId: context.companyId,
      idleThresholdSeconds: 300,
      configVersion: 1,
    });
  }

  const excludedApplications = await store.listExclusions(context.companyId);
  return {
    settings,
    excludedApplications,
  };
}

export async function updateIdleThresholdWithStore(
  context: AuthContext,
  input: UpdateTrackingSettingsInput,
  store: TrackingSettingsStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  let existing = await store.getSettings(context.companyId);
  if (!existing) {
    existing = {
      id: `settings-${context.companyId}`,
      companyId: context.companyId,
      idleThresholdSeconds: 300,
      configVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const newVersion = existing.configVersion + 1;
  const updated = await store.saveSettings({
    id: existing.id,
    companyId: context.companyId,
    idleThresholdSeconds: input.idleThresholdSeconds,
    configVersion: newVersion,
  });

  await store.writeAudit({
    action: "TRACKING_SETTINGS_UPDATED",
    entityType: "CompanyTrackingSettings",
    entityId: updated.id,
    metadata: {
      previousThresholdSeconds: existing.idleThresholdSeconds,
      newThresholdSeconds: updated.idleThresholdSeconds,
      configVersion: updated.configVersion,
    },
  });

  return updated;
}

export async function addExcludedApplicationWithStore(
  context: AuthContext,
  input: AddExcludedApplicationInput,
  store: TrackingSettingsStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const duplicate = await store.findExclusionByProcess(
    input.processName,
    context.companyId,
  );
  if (duplicate) {
    throw new ApiError(
      "CONFLICT",
      "This application is already in the exclusion list.",
      409,
    );
  }

  const created = await store.createExclusion({
    companyId: context.companyId,
    processName: input.processName,
    displayName: input.displayName ?? null,
  });

  let settings = await store.getSettings(context.companyId);
  if (!settings) {
    settings = {
      id: `settings-${context.companyId}`,
      companyId: context.companyId,
      idleThresholdSeconds: 300,
      configVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const newVersion = settings.configVersion + 1;
  await store.saveSettings({
    id: settings.id,
    companyId: context.companyId,
    idleThresholdSeconds: settings.idleThresholdSeconds,
    configVersion: newVersion,
  });

  await store.writeAudit({
    action: "EXCLUDED_APPLICATION_ADDED",
    entityType: "ExcludedApplication",
    entityId: created.id,
    metadata: {
      processName: created.processName,
      displayName: created.displayName,
      configVersion: newVersion,
    },
  });

  return { ...created, configVersion: newVersion };
}

export async function updateExcludedApplicationWithStore(
  context: AuthContext,
  id: string,
  input: UpdateExcludedApplicationInput,
  store: TrackingSettingsStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const existing = await store.findExclusionById(id, context.companyId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Excluded application not found.", 404);
  }

  const updated = await store.updateExclusion(id, {
    displayName: input.displayName ?? null,
  });

  let settings = await store.getSettings(context.companyId);
  if (!settings) {
    settings = {
      id: `settings-${context.companyId}`,
      companyId: context.companyId,
      idleThresholdSeconds: 300,
      configVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const newVersion = settings.configVersion + 1;
  await store.saveSettings({
    id: settings.id,
    companyId: context.companyId,
    idleThresholdSeconds: settings.idleThresholdSeconds,
    configVersion: newVersion,
  });

  await store.writeAudit({
    action: "EXCLUDED_APPLICATION_UPDATED",
    entityType: "ExcludedApplication",
    entityId: updated.id,
    metadata: {
      processName: updated.processName,
      displayName: updated.displayName,
      configVersion: newVersion,
    },
  });

  return { ...updated, configVersion: newVersion };
}

export async function removeExcludedApplicationWithStore(
  context: AuthContext,
  id: string,
  store: TrackingSettingsStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const existing = await store.findExclusionById(id, context.companyId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Excluded application not found.", 404);
  }

  await store.deleteExclusion(id);

  let settings = await store.getSettings(context.companyId);
  if (!settings) {
    settings = {
      id: `settings-${context.companyId}`,
      companyId: context.companyId,
      idleThresholdSeconds: 300,
      configVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const newVersion = settings.configVersion + 1;
  await store.saveSettings({
    id: settings.id,
    companyId: context.companyId,
    idleThresholdSeconds: settings.idleThresholdSeconds,
    configVersion: newVersion,
  });

  await store.writeAudit({
    action: "EXCLUDED_APPLICATION_REMOVED",
    entityType: "ExcludedApplication",
    entityId: id,
    metadata: {
      processName: existing.processName,
      configVersion: newVersion,
    },
  });

  return { success: true, configVersion: newVersion };
}

// -----------------------------------------------------------------------------
// Production Prisma Store Implementations
// -----------------------------------------------------------------------------

function createPrismaStore(context: AuthContext): TrackingSettingsStore {
  return {
    async getSettings(companyId) {
      return prisma.companyTrackingSettings.findUnique({
        where: { companyId },
      });
    },
    async saveSettings(data) {
      return prisma.companyTrackingSettings.upsert({
        where: { companyId: data.companyId },
        create: {
          companyId: data.companyId,
          idleThresholdSeconds: data.idleThresholdSeconds,
          configVersion: data.configVersion,
        },
        update: {
          idleThresholdSeconds: data.idleThresholdSeconds,
          configVersion: data.configVersion,
        },
      });
    },
    async findExclusionById(id, companyId) {
      return prisma.excludedApplication.findFirst({
        where: tenantWhere(companyId, { id }),
        select: {
          id: true,
          companyId: true,
          processName: true,
          displayName: true,
        },
      });
    },
    async findExclusionByProcess(processName, companyId) {
      return prisma.excludedApplication.findFirst({
        where: { companyId, processName },
        select: { id: true },
      });
    },
    async listExclusions(companyId) {
      return prisma.excludedApplication.findMany({
        where: tenantWhere(companyId, {}),
        orderBy: [{ displayName: "asc" }, { processName: "asc" }],
      });
    },
    async createExclusion(data) {
      return prisma.excludedApplication.create({
        data,
      });
    },
    async updateExclusion(id, data) {
      return prisma.excludedApplication.update({
        where: { id },
        data,
      });
    },
    async deleteExclusion(id) {
      await prisma.excludedApplication.delete({
        where: { id },
      });
    },
    async writeAudit(entry) {
      await writeAudit(prisma, {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      });
    },
  };
}

export async function getCompanyTrackingSettings(context: AuthContext) {
  return getCompanyTrackingSettingsWithStore(context, createPrismaStore(context));
}

export async function updateIdleThreshold(
  context: AuthContext,
  input: UpdateTrackingSettingsInput,
  store?: TrackingSettingsStore,
) {
  return updateIdleThresholdWithStore(
    context,
    input,
    store ?? createPrismaStore(context),
  );
}

export async function addExcludedApplication(
  context: AuthContext,
  input: AddExcludedApplicationInput,
  store?: TrackingSettingsStore,
) {
  return addExcludedApplicationWithStore(
    context,
    input,
    store ?? createPrismaStore(context),
  );
}

export async function updateExcludedApplication(
  context: AuthContext,
  id: string,
  input: UpdateExcludedApplicationInput,
  store?: TrackingSettingsStore,
) {
  return updateExcludedApplicationWithStore(
    context,
    id,
    input,
    store ?? createPrismaStore(context),
  );
}

export async function removeExcludedApplication(
  context: AuthContext,
  id: string,
  store?: TrackingSettingsStore,
) {
  return removeExcludedApplicationWithStore(
    context,
    id,
    store ?? createPrismaStore(context),
  );
}

import { assertRole, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditEntry } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import type { UpdateSystemSettingsInput } from "@/lib/validation/system-settings";

export type SystemSettingsRecord = {
  id: string;
  notificationDueSoonHours: number;
  defaultIdleThresholdSeconds: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SystemSettingsStore = {
  getSettings(): Promise<SystemSettingsRecord | null>;
  upsertSettings(data: {
    notificationDueSoonHours?: number;
    defaultIdleThresholdSeconds?: number;
  }): Promise<SystemSettingsRecord>;
  writeAudit(entry: AuditEntry): Promise<void>;
};

export const defaultSystemSettingsStore: SystemSettingsStore = {
  async getSettings() {
    return prisma.systemSettings.findUnique({
      where: { id: "system" },
    });
  },
  async upsertSettings(data) {
    return prisma.systemSettings.upsert({
      where: { id: "system" },
      create: {
        id: "system",
        notificationDueSoonHours: data.notificationDueSoonHours ?? 24,
        defaultIdleThresholdSeconds: data.defaultIdleThresholdSeconds ?? 300,
      },
      update: {
        ...(data.notificationDueSoonHours !== undefined
          ? { notificationDueSoonHours: data.notificationDueSoonHours }
          : {}),
        ...(data.defaultIdleThresholdSeconds !== undefined
          ? { defaultIdleThresholdSeconds: data.defaultIdleThresholdSeconds }
          : {}),
      },
    });
  },
  async writeAudit(entry) {
    await writeAudit(prisma, entry);
  },
};

export async function getSystemSettingsWithStore(
  context?: AuthContext,
  store: SystemSettingsStore = defaultSystemSettingsStore
): Promise<SystemSettingsRecord> {
  // If context provided, ensure at least MANAGER or SUPER_ADMIN (or allow internal system call)
  if (context) {
    assertRole(context, ["SUPER_ADMIN", "MANAGER"]);
  }

  const existing = await store.getSettings();
  if (existing) {
    return existing;
  }

  return store.upsertSettings({
    notificationDueSoonHours: 24,
    defaultIdleThresholdSeconds: 300,
  });
}

export async function updateSystemSettingsWithStore(
  context: AuthContext,
  input: UpdateSystemSettingsInput,
  store: SystemSettingsStore = defaultSystemSettingsStore
): Promise<SystemSettingsRecord> {
  assertRole(context, ["SUPER_ADMIN"]);

  const existing = await getSystemSettingsWithStore(context, store);

  const updated = await store.upsertSettings({
    notificationDueSoonHours: input.notificationDueSoonHours,
    defaultIdleThresholdSeconds: input.defaultIdleThresholdSeconds,
  });

  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "SYSTEM_SETTINGS_UPDATED",
    entityType: "SystemSettings",
    entityId: updated.id,
    metadata: {
      before: {
        notificationDueSoonHours: existing.notificationDueSoonHours,
        defaultIdleThresholdSeconds: existing.defaultIdleThresholdSeconds,
      },
      after: {
        notificationDueSoonHours: updated.notificationDueSoonHours,
        defaultIdleThresholdSeconds: updated.defaultIdleThresholdSeconds,
      },
    },
  });

  return updated;
}

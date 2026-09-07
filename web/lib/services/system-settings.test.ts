import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import {
  getSystemSettingsWithStore,
  updateSystemSettingsWithStore,
  type SystemSettingsRecord,
  type SystemSettingsStore,
} from "@/lib/services/system-settings";
import { updateSystemSettingsSchema } from "@/lib/validation/system-settings";

const superAdmin: AuthContext = {
  companyId: "comp-super",
  userId: "user-super",
  employeeId: null,
  role: "SUPER_ADMIN",
};

const manager: AuthContext = {
  companyId: "comp-mgr",
  userId: "user-mgr",
  employeeId: "emp-mgr",
  role: "MANAGER",
};

const employee: AuthContext = {
  companyId: "comp-emp",
  userId: "user-emp",
  employeeId: "emp-emp",
  role: "EMPLOYEE",
};

function createMockSystemSettingsStore(initial?: Partial<SystemSettingsRecord>) {
  let current: SystemSettingsRecord | null = initial
    ? {
        id: "system",
        notificationDueSoonHours: initial.notificationDueSoonHours ?? 24,
        defaultIdleThresholdSeconds: initial.defaultIdleThresholdSeconds ?? 300,
        createdAt: initial.createdAt ?? new Date(),
        updatedAt: initial.updatedAt ?? new Date(),
      }
    : null;

  const auditLogs: any[] = [];

  const store: SystemSettingsStore = {
    async getSettings() {
      return current;
    },
    async upsertSettings(data) {
      const now = new Date();
      current = {
        id: "system",
        notificationDueSoonHours:
          data.notificationDueSoonHours ?? current?.notificationDueSoonHours ?? 24,
        defaultIdleThresholdSeconds:
          data.defaultIdleThresholdSeconds ??
          current?.defaultIdleThresholdSeconds ??
          300,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      return current;
    },
    async writeAudit(entry) {
      auditLogs.push(entry);
    },
  };

  return { store, getCurrent: () => current, auditLogs };
}

test("SystemSettings: initializes with sensible defaults (24h, 300s) if not stored", async () => {
  const { store } = createMockSystemSettingsStore();
  const settings = await getSystemSettingsWithStore(superAdmin, store);

  assert.equal(settings.id, "system");
  assert.equal(settings.notificationDueSoonHours, 24);
  assert.equal(settings.defaultIdleThresholdSeconds, 300);
});

test("SystemSettings: Super Admin can update settings and audits SYSTEM_SETTINGS_UPDATED", async () => {
  const { store, auditLogs } = createMockSystemSettingsStore({
    notificationDueSoonHours: 24,
    defaultIdleThresholdSeconds: 300,
  });

  const validated = updateSystemSettingsSchema.parse({
    notificationDueSoonHours: 48,
    defaultIdleThresholdSeconds: 600,
  });

  const updated = await updateSystemSettingsWithStore(superAdmin, validated, store);

  assert.equal(updated.notificationDueSoonHours, 48);
  assert.equal(updated.defaultIdleThresholdSeconds, 600);

  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "SYSTEM_SETTINGS_UPDATED");
  assert.equal(auditLogs[0].entityType, "SystemSettings");
  assert.equal(auditLogs[0].entityId, "system");
  assert.deepEqual(auditLogs[0].metadata?.before, {
    notificationDueSoonHours: 24,
    defaultIdleThresholdSeconds: 300,
  });
  assert.deepEqual(auditLogs[0].metadata?.after, {
    notificationDueSoonHours: 48,
    defaultIdleThresholdSeconds: 600,
  });
});

test("Security: Managers and Employees are strictly forbidden from modifying system settings", async () => {
  const { store } = createMockSystemSettingsStore();
  const input = { notificationDueSoonHours: 12, defaultIdleThresholdSeconds: 120 };

  await assert.rejects(
    async () => {
      await updateSystemSettingsWithStore(manager, input, store);
    },
    /You do not have access to this resource/
  );

  await assert.rejects(
    async () => {
      await updateSystemSettingsWithStore(employee, input, store);
    },
    /You do not have access to this resource/
  );
});

test("Validation: enforces valid boundaries on system settings", () => {
  // Valid bounds
  assert.ok(
    updateSystemSettingsSchema.parse({
      notificationDueSoonHours: 1,
      defaultIdleThresholdSeconds: 60,
    })
  );
  assert.ok(
    updateSystemSettingsSchema.parse({
      notificationDueSoonHours: 168,
      defaultIdleThresholdSeconds: 1800,
    })
  );

  // Invalid: below minimum
  assert.throws(() =>
    updateSystemSettingsSchema.parse({
      notificationDueSoonHours: 0,
      defaultIdleThresholdSeconds: 60,
    })
  );
  assert.throws(() =>
    updateSystemSettingsSchema.parse({
      notificationDueSoonHours: 24,
      defaultIdleThresholdSeconds: 59,
    })
  );

  // Invalid: above maximum
  assert.throws(() =>
    updateSystemSettingsSchema.parse({
      notificationDueSoonHours: 169,
      defaultIdleThresholdSeconds: 600,
    })
  );
  assert.throws(() =>
    updateSystemSettingsSchema.parse({
      notificationDueSoonHours: 24,
      defaultIdleThresholdSeconds: 1801,
    })
  );
});

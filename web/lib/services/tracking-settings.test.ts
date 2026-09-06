import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import {
  addExcludedApplicationWithStore,
  getCompanyTrackingSettingsWithStore,
  removeExcludedApplicationWithStore,
  updateExcludedApplicationWithStore,
  updateIdleThresholdWithStore,
  type TrackingSettingsStore,
} from "@/lib/services/tracking-settings";

const managerAlpha: AuthContext = {
  companyId: "company-alpha",
  userId: "mgr-alpha",
  employeeId: "emp-mgr-alpha",
  role: "MANAGER",
};

const employeeAlpha: AuthContext = {
  companyId: "company-alpha",
  userId: "emp-alpha",
  employeeId: "emp-staff-alpha",
  role: "EMPLOYEE",
};

function createMockTrackingStore(initialState?: {
  settings?: {
    id: string;
    companyId: string;
    idleThresholdSeconds: number;
    configVersion: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
  exclusions?: Array<{
    id: string;
    companyId: string;
    processName: string;
    displayName: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
}) {
  let settings = initialState?.settings
    ? {
        ...initialState.settings,
        createdAt: initialState.settings.createdAt ?? new Date(),
        updatedAt: initialState.settings.updatedAt ?? new Date(),
      }
    : null;

  const exclusions = (initialState?.exclusions ?? []).map((e) => ({
    ...e,
    createdAt: e.createdAt ?? new Date(),
    updatedAt: e.updatedAt ?? new Date(),
  }));

  const audits: Array<{
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }> = [];

  const store: TrackingSettingsStore = {
    async getSettings(companyId) {
      if (settings && settings.companyId === companyId) return settings;
      return null;
    },
    async saveSettings(data) {
      const now = new Date();
      settings = {
        id: data.id,
        companyId: data.companyId,
        idleThresholdSeconds: data.idleThresholdSeconds,
        configVersion: data.configVersion,
        createdAt: settings?.createdAt ?? now,
        updatedAt: now,
      };
      return settings;
    },
    async findExclusionById(id, companyId) {
      const found = exclusions.find((e) => e.id === id && e.companyId === companyId);
      return found ?? null;
    },
    async findExclusionByProcess(processName, companyId) {
      const found = exclusions.find(
        (e) => e.processName === processName && e.companyId === companyId,
      );
      return found ? { id: found.id } : null;
    },
    async listExclusions(companyId) {
      return exclusions.filter((e) => e.companyId === companyId);
    },
    async createExclusion(data) {
      const created = {
        id: `excl-${exclusions.length + 1}`,
        companyId: data.companyId,
        processName: data.processName,
        displayName: data.displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      exclusions.push(created);
      return created;
    },
    async updateExclusion(id, data) {
      const index = exclusions.findIndex((e) => e.id === id);
      if (index === -1) throw new Error("Not found");
      const current = exclusions[index]!;
      const updated = {
        ...current,
        displayName: data.displayName !== undefined ? data.displayName : current.displayName,
        updatedAt: new Date(),
      };
      exclusions[index] = updated;
      return updated;
    },
    async deleteExclusion(id) {
      const index = exclusions.findIndex((e) => e.id === id);
      if (index !== -1) exclusions.splice(index, 1);
    },
    async writeAudit(entry) {
      audits.push(entry);
    },
  };

  return { store, audits, getExclusions: () => exclusions, getSettings: () => settings };
}

test("getCompanyTrackingSettings creates default 300s threshold and configVersion 1", async () => {
  const { store } = createMockTrackingStore();

  const data = await getCompanyTrackingSettingsWithStore(managerAlpha, store);
  assert.equal(data.settings.idleThresholdSeconds, 300);
  assert.equal(data.settings.configVersion, 1);
  assert.equal(data.excludedApplications.length, 0);
});

test("manager can update idle threshold, which increments configVersion and writes audit", async () => {
  const { store, audits } = createMockTrackingStore({
    settings: {
      id: "settings-alpha",
      companyId: "company-alpha",
      idleThresholdSeconds: 300,
      configVersion: 1,
    },
  });

  const updated = await updateIdleThresholdWithStore(
    managerAlpha,
    { idleThresholdSeconds: 600 },
    store,
  );

  assert.equal(updated.idleThresholdSeconds, 600);
  assert.equal(updated.configVersion, 2);

  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "TRACKING_SETTINGS_UPDATED");
  assert.equal(audits[0]?.metadata?.previousThresholdSeconds, 300);
  assert.equal(audits[0]?.metadata?.newThresholdSeconds, 600);
  assert.equal(audits[0]?.metadata?.configVersion, 2);
});

test("employee cannot read or modify tracking settings (forbidden)", async () => {
  const { store } = createMockTrackingStore();

  await assert.rejects(
    () => getCompanyTrackingSettingsWithStore(employeeAlpha, store),
    (err: unknown) => err instanceof ApiError && err.code === "FORBIDDEN" && err.status === 403,
  );

  await assert.rejects(
    () => updateIdleThresholdWithStore(employeeAlpha, { idleThresholdSeconds: 600 }, store),
    (err: unknown) => err instanceof ApiError && err.code === "FORBIDDEN" && err.status === 403,
  );

  await assert.rejects(
    () => addExcludedApplicationWithStore(employeeAlpha, { processName: "steam.exe", displayName: null }, store),
    (err: unknown) => err instanceof ApiError && err.code === "FORBIDDEN" && err.status === 403,
  );
});

test("addExcludedApplication adds exclusion, increments configVersion, and rejects duplicates", async () => {
  const { store, audits, getExclusions } = createMockTrackingStore({
    settings: {
      id: "settings-alpha",
      companyId: "company-alpha",
      idleThresholdSeconds: 300,
      configVersion: 1,
    },
  });

  const created = await addExcludedApplicationWithStore(
    managerAlpha,
    { processName: "whatsapp.exe", displayName: "WhatsApp" },
    store,
  );

  assert.equal(created.processName, "whatsapp.exe");
  assert.equal(created.configVersion, 2);
  assert.equal(getExclusions().length, 1);

  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "EXCLUDED_APPLICATION_ADDED");
  assert.equal(audits[0]?.metadata?.processName, "whatsapp.exe");
  assert.equal(audits[0]?.metadata?.configVersion, 2);

  // Reject duplicate in same company
  await assert.rejects(
    () =>
      addExcludedApplicationWithStore(
        managerAlpha,
        { processName: "whatsapp.exe", displayName: "WhatsApp Clone" },
        store,
      ),
    (err: unknown) => err instanceof ApiError && err.code === "CONFLICT" && err.status === 409,
  );
});

test("updateExcludedApplication updates display name and increments configVersion", async () => {
  const { store, audits } = createMockTrackingStore({
    settings: {
      id: "settings-alpha",
      companyId: "company-alpha",
      idleThresholdSeconds: 300,
      configVersion: 2,
    },
    exclusions: [
      {
        id: "excl-1",
        companyId: "company-alpha",
        processName: "1password.exe",
        displayName: "1Pass",
      },
    ],
  });

  const updated = await updateExcludedApplicationWithStore(
    managerAlpha,
    "excl-1",
    { displayName: "1Password Desktop" },
    store,
  );

  assert.equal(updated.displayName, "1Password Desktop");
  assert.equal(updated.configVersion, 3);

  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "EXCLUDED_APPLICATION_UPDATED");
  assert.equal(audits[0]?.metadata?.configVersion, 3);
});

test("removeExcludedApplication removes exclusion, increments configVersion, and blocks cross-company deletion", async () => {
  const { store, audits, getExclusions } = createMockTrackingStore({
    settings: {
      id: "settings-alpha",
      companyId: "company-alpha",
      idleThresholdSeconds: 300,
      configVersion: 3,
    },
    exclusions: [
      {
        id: "excl-1",
        companyId: "company-alpha",
        processName: "spotify.exe",
        displayName: "Spotify",
      },
      {
        id: "excl-beta",
        companyId: "company-beta",
        processName: "discord.exe",
        displayName: "Discord",
      },
    ],
  });

  // Cross company removal blocked
  await assert.rejects(
    () => removeExcludedApplicationWithStore(managerAlpha, "excl-beta", store),
    (err: unknown) => err instanceof ApiError && err.code === "NOT_FOUND" && err.status === 404,
  );

  // Own company removal succeeds
  const removed = await removeExcludedApplicationWithStore(managerAlpha, "excl-1", store);
  assert.equal(removed.success, true);
  assert.equal(removed.configVersion, 4);
  assert.equal(getExclusions().length, 1); // only excl-beta remains

  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "EXCLUDED_APPLICATION_REMOVED");
  assert.equal(audits[0]?.metadata?.processName, "spotify.exe");
  assert.equal(audits[0]?.metadata?.configVersion, 4);
});

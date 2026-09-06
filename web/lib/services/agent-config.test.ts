import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedDevice } from "@/lib/agent/authenticate";
import {
  getAgentConfig,
  type AgentConfigStore,
} from "@/lib/services/agent-config";

const deviceAlpha: AuthenticatedDevice = {
  companyId: "company-alpha",
  databaseId: "dev-alpha-1",
  employeeId: "emp-alpha-1",
  publicId: "PC-ALPHA-01",
};

const deviceBeta: AuthenticatedDevice = {
  companyId: "company-beta",
  databaseId: "dev-beta-1",
  employeeId: "emp-beta-1",
  publicId: "PC-BETA-01",
};

function createMockStore(
  settingsByCompany: Record<string, { configVersion: number; idleThresholdSeconds: number }>,
  exclusionsByCompany: Record<string, string[]>,
): AgentConfigStore {
  return {
    async getSettings(companyId) {
      return settingsByCompany[companyId] ?? null;
    },
    async listExcludedProcessNames(companyId) {
      return exclusionsByCompany[companyId] ?? [];
    },
  };
}

test("getAgentConfig returns default configuration when company has no stored settings", async () => {
  const store = createMockStore({}, {});

  const config = await getAgentConfig(deviceAlpha, store);

  assert.equal(config.configVersion, 1);
  assert.equal(config.idleThresholdSeconds, 300);
  assert.deepEqual(config.excludedProcesses, []);
});

test("getAgentConfig returns company-specific settings and exclusions", async () => {
  const store = createMockStore(
    {
      "company-alpha": {
        configVersion: 5,
        idleThresholdSeconds: 120,
      },
    },
    {
      "company-alpha": ["whatsapp.exe", "slack.exe", "1password.exe"],
    },
  );

  const config = await getAgentConfig(deviceAlpha, store);

  assert.equal(config.configVersion, 5);
  assert.equal(config.idleThresholdSeconds, 120);
  assert.deepEqual(config.excludedProcesses, [
    "whatsapp.exe",
    "slack.exe",
    "1password.exe",
  ]);
});

test("tenant isolation: device receives only its own company configuration", async () => {
  const store = createMockStore(
    {
      "company-alpha": {
        configVersion: 3,
        idleThresholdSeconds: 60,
      },
      "company-beta": {
        configVersion: 8,
        idleThresholdSeconds: 900,
      },
    },
    {
      "company-alpha": ["secret-app-alpha.exe"],
      "company-beta": ["banking-beta.exe", "keepass.exe"],
    },
  );

  const configAlpha = await getAgentConfig(deviceAlpha, store);
  const configBeta = await getAgentConfig(deviceBeta, store);

  assert.equal(configAlpha.configVersion, 3);
  assert.equal(configAlpha.idleThresholdSeconds, 60);
  assert.deepEqual(configAlpha.excludedProcesses, ["secret-app-alpha.exe"]);

  assert.equal(configBeta.configVersion, 8);
  assert.equal(configBeta.idleThresholdSeconds, 900);
  assert.deepEqual(configBeta.excludedProcesses, ["banking-beta.exe", "keepass.exe"]);
});

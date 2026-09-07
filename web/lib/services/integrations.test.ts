import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import {
  configureIntegrationWithStore,
  disconnectIntegrationWithStore,
  getDecryptedCredentialsWithStore,
  getIntegrationWithStore,
  listCompanyIntegrationsWithStore,
  recordIntegrationSyncStatusWithStore,
  type IntegrationMappingRecord,
  type IntegrationRecord,
  type IntegrationStore,
} from "@/lib/services/integrations";

const managerA: AuthContext = {
  companyId: "comp-a",
  userId: "mgr-a",
  employeeId: "emp-a",
  role: "MANAGER",
};

const employeeA: AuthContext = {
  companyId: "comp-a",
  userId: "user-emp-a",
  employeeId: "emp-a",
  role: "EMPLOYEE",
};

function createMockIntegrationStore() {
  const integrations = new Map<string, IntegrationRecord>();
  const mappings = new Map<string, IntegrationMappingRecord>();
  const auditLogs: any[] = [];

  const store: IntegrationStore = {
    async findIntegration(companyId, provider) {
      return integrations.get(`${companyId}:${provider}`) ?? null;
    },
    async upsertIntegration(companyId, provider, data) {
      const key = `${companyId}:${provider}`;
      const existing = integrations.get(key);
      const record: IntegrationRecord = {
        id: existing?.id ?? `integ-${integrations.size + 1}`,
        companyId,
        provider,
        status: data.status ?? existing?.status ?? "NOT_CONFIGURED",
        encryptedCredentials:
          data.encryptedCredentials !== undefined
            ? data.encryptedCredentials
            : existing?.encryptedCredentials ?? null,
        config: data.config !== undefined ? (data.config as any) : existing?.config ?? null,
        lastSyncAt: data.lastSyncAt !== undefined ? data.lastSyncAt : existing?.lastSyncAt ?? null,
        lastError: data.lastError !== undefined ? data.lastError : existing?.lastError ?? null,
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      integrations.set(key, record);
      return record;
    },
    async deleteIntegration(companyId, provider) {
      integrations.delete(`${companyId}:${provider}`);
    },
    async listCompanyIntegrations(companyId) {
      return Array.from(integrations.values()).filter(
        (r) => r.companyId === companyId
      );
    },
    async findMapping(companyId, provider, externalEntityType, externalId) {
      return mappings.get(`${companyId}:${provider}:${externalEntityType}:${externalId}`) ?? null;
    },
    async findMappingByInternal(companyId, provider, internalEntityType, internalId) {
      for (const m of mappings.values()) {
        if (
          m.companyId === companyId &&
          m.provider === provider &&
          m.internalEntityType === internalEntityType &&
          m.internalId === internalId
        ) {
          return m;
        }
      }
      return null;
    },
    async upsertMapping(
      companyId,
      provider,
      externalEntityType,
      externalId,
      internalEntityType,
      internalId,
      metadata
    ) {
      const key = `${companyId}:${provider}:${externalEntityType}:${externalId}`;
      const record: IntegrationMappingRecord = {
        id: `map-${mappings.size + 1}`,
        companyId,
        provider,
        externalEntityType,
        externalId,
        internalEntityType,
        internalId,
        metadata: (metadata as any) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mappings.set(key, record);
      return record;
    },
    async writeAudit(entry) {
      auditLogs.push(entry);
    },
  };

  return { store, integrations, mappings, auditLogs };
}

test("Security: Employees are strictly forbidden from viewing or configuring integrations", async () => {
  const { store } = createMockIntegrationStore();

  await assert.rejects(
    async () => {
      await listCompanyIntegrationsWithStore(employeeA, store);
    },
    /You do not have access to this resource/
  );

  await assert.rejects(
    async () => {
      await getIntegrationWithStore(employeeA, "CLICKUP", store);
    },
    /You do not have access to this resource/
  );

  await assert.rejects(
    async () => {
      await configureIntegrationWithStore(
        employeeA,
        "CLICKUP",
        { apiToken: "secret_token_123" },
        {},
        store
      );
    },
    /You do not have access to this resource/
  );

  await assert.rejects(
    async () => {
      await disconnectIntegrationWithStore(employeeA, "CLICKUP", store);
    },
    /You do not have access to this resource/
  );
});

test("Security: Configured secrets are encrypted at rest and never exposed to the client or in audit logs", async () => {
  const { store, integrations, auditLogs } = createMockIntegrationStore();

  const secretToken = "super_secret_personal_api_token_xyz987";
  const publicView = await configureIntegrationWithStore(
    managerA,
    "CLICKUP",
    { apiToken: secretToken },
    { listId: "list-456" },
    store
  );

  // 1. Public view must never contain the token
  assert.equal((publicView as any).apiToken, undefined);
  assert.equal((publicView as any).encryptedCredentials, undefined);
  assert.equal(publicView.isConfigured, true);
  assert.equal(publicView.status, "CONFIGURED");
  assert.equal(publicView.config?.listId, "list-456");

  // 2. Storage must have encrypted credentials (not plaintext)
  const storedRecord = integrations.get("comp-a:CLICKUP");
  assert.ok(storedRecord?.encryptedCredentials);
  assert.ok(storedRecord.encryptedCredentials.startsWith("v1:"));
  assert.ok(!storedRecord.encryptedCredentials.includes(secretToken));

  // 3. Audit log must record configuration WITHOUT including credentials
  assert.equal(auditLogs.length, 1);
  const audit = auditLogs[0];
  assert.equal(audit.action, "INTEGRATION_CONFIGURED");
  assert.equal(audit.metadata?.provider, "CLICKUP");
  assert.equal(audit.metadata?.hasConfig, true);
  assert.equal(audit.metadata?.apiToken, undefined);
  assert.equal(JSON.stringify(audit.metadata).includes(secretToken), false);

  // 4. Server-side decryption works correctly for background sync
  const decrypted = await getDecryptedCredentialsWithStore<{ apiToken: string }>(
    "comp-a",
    "CLICKUP",
    store
  );
  assert.equal(decrypted?.credentials.apiToken, secretToken);
});

test("Tenant isolation: Company A manager cannot access Company B integration credentials", async () => {
  const { store } = createMockIntegrationStore();

  await configureIntegrationWithStore(
    { companyId: "comp-b", userId: "mgr-b", employeeId: null, role: "MANAGER" },
    "CLOCKIFY",
    { apiKey: "company-b-clockify-key" },
    { workspaceId: "ws-b" },
    store
  );

  // Manager A requests integrations list for comp-a
  const compAIntegrations = await listCompanyIntegrationsWithStore(managerA, store);
  const clockifyA = compAIntegrations.find((i) => i.provider === "CLOCKIFY");
  assert.equal(clockifyA?.status, "NOT_CONFIGURED");
  assert.equal(clockifyA?.isConfigured, false);
});

test("Integration lifecycle: Status transitions NOT_CONFIGURED -> CONFIGURED -> CONNECTED / ERROR", async () => {
  const { store } = createMockIntegrationStore();

  // 1. Initial state is NOT_CONFIGURED
  const initial = await getIntegrationWithStore(managerA, "CLICKUP", store);
  assert.equal(initial.status, "NOT_CONFIGURED");

  // 2. Configuration without testing transitions to CONFIGURED
  const configured = await configureIntegrationWithStore(
    managerA,
    "CLICKUP",
    { apiToken: "token_123" },
    { listId: "list_abc" },
    store
  );
  assert.equal(configured.status, "CONFIGURED");

  // 3. Successful connection test transitions to CONNECTED
  const connected = await configureIntegrationWithStore(
    managerA,
    "CLICKUP",
    { apiToken: "token_123" },
    { listId: "list_abc" },
    store,
    async () => ({ success: true })
  );
  assert.equal(connected.status, "CONNECTED");

  // 4. Failed connection test transitions to ERROR with error message
  const failed = await configureIntegrationWithStore(
    managerA,
    "CLICKUP",
    { apiToken: "bad_token" },
    { listId: "list_abc" },
    store,
    async () => ({ success: false, message: "Invalid API token" })
  );
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.lastError, "Invalid API token");
});

test("Integration sync status: records CONNECTED with new sync timestamp, and ERROR preserves previous lastSyncAt", async () => {
  const { store } = createMockIntegrationStore();

  // Configure first
  await configureIntegrationWithStore(
    managerA,
    "KOLAY_IK",
    { apiToken: "tok_123" },
    {},
    store
  );

  // 1. Initial sync success: sets CONNECTED and records lastSyncAt
  await recordIntegrationSyncStatusWithStore("comp-a", "KOLAY_IK", "CONNECTED", null, store);
  const synced = await getIntegrationWithStore(managerA, "KOLAY_IK", store);
  assert.equal(synced.status, "CONNECTED");
  assert.ok(synced.lastSyncAt);
  const initialSyncAt = synced.lastSyncAt;

  // 2. Subsequent sync failure: sets ERROR, records error message, retains initialSyncAt
  await recordIntegrationSyncStatusWithStore("comp-a", "KOLAY_IK", "ERROR", "Network connection timeout", store);
  const failed = await getIntegrationWithStore(managerA, "KOLAY_IK", store);
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.lastError, "Network connection timeout");
  assert.equal(failed.lastSyncAt, initialSyncAt);
});


import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import {
  configureIntegrationWithStore,
  disconnectIntegrationWithStore,
  getDecryptedCredentialsWithStore,
  getIntegrationWithStore,
  listCompanyIntegrationsWithStore,
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
  assert.equal(publicView.status, "CONNECTED");
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

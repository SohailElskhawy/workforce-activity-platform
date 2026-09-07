import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { encryptJson } from "@/lib/crypto/secret";
import type {
  ClockifyClient,
  ClockifyProject,
  ClockifyTimeEntry,
  ClockifyUser,
  ClockifyWorkspace,
} from "@/lib/integrations/clockify/client";
import {
  importClockifyHistoricalTime,
  type ClockifyImportDatabase,
} from "@/lib/integrations/clockify/import";
import type {
  IntegrationMappingRecord,
  IntegrationRecord,
} from "@/lib/services/integrations";

const managerAlpha: AuthContext = {
  companyId: "comp-alpha",
  userId: "mgr-alpha",
  employeeId: "emp-alpha",
  role: "MANAGER",
};

const managerBeta: AuthContext = {
  companyId: "comp-beta",
  userId: "mgr-beta",
  employeeId: "emp-beta",
  role: "MANAGER",
};

function createMockClockifyDatabase() {
  const integrations = new Map<string, IntegrationRecord>();
  const mappings = new Map<string, IntegrationMappingRecord>();
  const employees = new Map<string, { id: string; email: string; companyId: string }>();
  const projects = new Map<string, { id: string; name: string; companyId: string }>();
  const timeEntries = new Map<
    string,
    {
      id: string;
      companyId: string;
      employeeId: string;
      projectId: string;
      taskId: string | null;
      startAt: Date;
      endAt: Date;
      durationMinutes: number;
      notes: string | null;
      source: string;
      externalId: string;
    }
  >();

  const db: ClockifyImportDatabase = {
    async findIntegration(companyId) {
      return integrations.get(companyId) ?? null;
    },
    async findMapping(companyId, externalType, externalId) {
      return mappings.get(`${companyId}:${externalType}:${externalId}`) ?? null;
    },
    async upsertMapping(companyId, externalType, externalId, internalType, internalId, metadata) {
      const key = `${companyId}:${externalType}:${externalId}`;
      const record: IntegrationMappingRecord = {
        id: `map-${mappings.size + 1}`,
        companyId,
        provider: "CLOCKIFY",
        externalEntityType: externalType,
        externalId,
        internalEntityType: internalType,
        internalId,
        metadata: (metadata as any) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mappings.set(key, record);
      return record;
    },
    async findEmployeeByEmail(companyId, email) {
      for (const emp of employees.values()) {
        if (emp.companyId === companyId && emp.email.toLowerCase() === email.toLowerCase()) {
          return { id: emp.id, email: emp.email };
        }
      }
      return null;
    },
    async findProjectByName(companyId, name) {
      for (const proj of projects.values()) {
        if (proj.companyId === companyId && proj.name.toLowerCase() === name.toLowerCase()) {
          return { id: proj.id, name: proj.name };
        }
      }
      return null;
    },
    async findTimeEntryByExternalId(companyId, externalId) {
      for (const te of timeEntries.values()) {
        if (te.companyId === companyId && te.source === "CLOCKIFY" && te.externalId === externalId) {
          return { id: te.id };
        }
      }
      return null;
    },
    async createTimeEntry(data) {
      const id = `te-${timeEntries.size + 1}`;
      timeEntries.set(id, {
        ...data,
        id,
        notes: data.notes ?? null,
        taskId: data.taskId ?? null,
      });
      return { id };
    },
    async recordSyncStatus(companyId, status, error) {
      const existing = integrations.get(companyId);
      if (existing) {
        integrations.set(companyId, {
          ...existing,
          status: status as any,
          lastSyncAt: new Date(),
          lastError: error ?? null,
        });
      }
    },
  };

  return { db, integrations, mappings, employees, projects, timeEntries };
}

test("Clockify historical import maps users, projects, and imports time entries with source metadata", async () => {
  const { db, integrations, employees, projects, timeEntries } = createMockClockifyDatabase();

  integrations.set("comp-alpha", {
    id: "integ-clk",
    companyId: "comp-alpha",
    provider: "CLOCKIFY",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiKey: "clk_api_key_test" }),
    config: { workspaceId: "ws-1" },
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Internal employees and projects
  employees.set("emp-1", { id: "emp-1", email: "selim@soda.com", companyId: "comp-alpha" });
  projects.set("proj-1", { id: "proj-1", name: "Metro Terminal CAD", companyId: "comp-alpha" });

  const mockUsers: ClockifyUser[] = [
    { id: "clk-u1", name: "Selim Yilmaz", email: "selim@soda.com" },
  ];

  const mockProjects: ClockifyProject[] = [
    { id: "clk-p1", name: "Metro Terminal CAD" },
  ];

  const mockEntries: ClockifyTimeEntry[] = [
    {
      id: "entry-101",
      description: "HVAC schematic detailing",
      userId: "clk-u1",
      projectId: "clk-p1",
      taskId: null,
      timeInterval: {
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T11:30:00.000Z", // 150 minutes
        duration: "PT2H30M",
      },
    },
    {
      id: "entry-102",
      description: "Structural column checks",
      userId: "clk-u1",
      projectId: "clk-p1",
      taskId: null,
      timeInterval: {
        start: "2026-09-01T13:00:00.000Z",
        end: "2026-09-01T14:00:00.000Z", // 60 minutes
        duration: "PT1H",
      },
    },
  ];

  const mockClient = {
    async getUsers() {
      return mockUsers;
    },
    async getProjects() {
      return mockProjects;
    },
    async getTimeEntries() {
      return mockEntries;
    },
  } as unknown as ClockifyClient;

  // Execute import
  const result = await importClockifyHistoricalTime(managerAlpha, {
    workspaceId: "ws-1",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-02T00:00:00.000Z",
    client: mockClient,
    db,
  });

  assert.equal(result.totalFound, 2);
  assert.equal(result.imported, 2);
  assert.equal(result.skippedDuplicate, 0);
  assert.equal(result.failed, 0);
  assert.equal(timeEntries.size, 2);

  const importedList = Array.from(timeEntries.values());
  const entry1 = importedList.find((e) => e.externalId === "entry-101")!;
  assert.equal(entry1.employeeId, "emp-1");
  assert.equal(entry1.projectId, "proj-1");
  assert.equal(entry1.durationMinutes, 150);
  assert.equal(entry1.source, "CLOCKIFY");
  assert.equal(entry1.notes, "HVAC schematic detailing");

  // Re-run import: all should be skipped as duplicates (idempotency verified!)
  const rerunResult = await importClockifyHistoricalTime(managerAlpha, {
    workspaceId: "ws-1",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-02T00:00:00.000Z",
    client: mockClient,
    db,
  });

  assert.equal(rerunResult.totalFound, 2);
  assert.equal(rerunResult.imported, 0);
  assert.equal(rerunResult.skippedDuplicate, 2);
  assert.equal(timeEntries.size, 2); // No duplicates created!
});

test("Clockify import records unmapped users and partial failures safely", async () => {
  const { db, integrations } = createMockClockifyDatabase();

  integrations.set("comp-alpha", {
    id: "integ-clk",
    companyId: "comp-alpha",
    provider: "CLOCKIFY",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiKey: "clk_api_key_test" }),
    config: { workspaceId: "ws-1" },
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Unknown user not in WorkLens
  const mockUsers: ClockifyUser[] = [
    { id: "clk-unknown", name: "Stranger", email: "stranger@other.com" },
  ];

  const mockEntries: ClockifyTimeEntry[] = [
    {
      id: "entry-999",
      description: "Ghost work",
      userId: "clk-unknown",
      projectId: null,
      taskId: null,
      timeInterval: {
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T10:00:00.000Z",
      },
    },
  ];

  const mockClient = {
    async getUsers() {
      return mockUsers;
    },
    async getProjects() {
      return [];
    },
    async getTimeEntries() {
      return mockEntries;
    },
  } as unknown as ClockifyClient;

  const result = await importClockifyHistoricalTime(managerAlpha, {
    workspaceId: "ws-1",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-02T00:00:00.000Z",
    client: mockClient,
    db,
  });

  assert.equal(result.totalFound, 1);
  assert.equal(result.imported, 0);
  assert.equal(result.unmapped, 1);
  assert.ok(result.errors.some((e) => e.includes("not mapped to any WorkLens employee")));
});

test("Clockify tenant isolation: Company A manager cannot import into Company B", async () => {
  const { db, integrations } = createMockClockifyDatabase();

  integrations.set("comp-beta", {
    id: "integ-clk-beta",
    companyId: "comp-beta",
    provider: "CLOCKIFY",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiKey: "beta-key" }),
    config: {},
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // managerAlpha belongs to comp-alpha, which has no integration configured
  await assert.rejects(
    async () => {
      await importClockifyHistoricalTime(managerAlpha, {
        workspaceId: "ws-b",
        startDate: "2026-09-01T00:00:00.000Z",
        endDate: "2026-09-02T00:00:00.000Z",
        db,
      });
    },
    /Clockify integration is not configured/
  );
});

test("Clockify project safety: unmapped project is skipped and never assigned to arbitrary/default project", async () => {
  const { db, integrations, employees, timeEntries } = createMockClockifyDatabase();

  integrations.set("comp-alpha", {
    id: "integ-clk",
    companyId: "comp-alpha",
    provider: "CLOCKIFY",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiKey: "clk_api_key_test" }),
    config: { workspaceId: "ws-1" },
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // User is mapped
  employees.set("emp-1", { id: "emp-1", email: "selim@soda.com", companyId: "comp-alpha" });

  const mockUsers: ClockifyUser[] = [
    { id: "clk-u1", name: "Selim Yilmaz", email: "selim@soda.com" },
  ];

  // But project is unmapped / unknown
  const mockEntries: ClockifyTimeEntry[] = [
    {
      id: "entry-unmapped-proj",
      description: "Mysterious project work",
      userId: "clk-u1",
      projectId: "clk-proj-unknown-999",
      taskId: null,
      timeInterval: {
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T11:00:00.000Z",
      },
    },
  ];

  const mockClient = {
    async getUsers() {
      return mockUsers;
    },
    async getProjects() {
      return []; // No projects returned
    },
    async getTimeEntries() {
      return mockEntries;
    },
  } as unknown as ClockifyClient;

  const result = await importClockifyHistoricalTime(managerAlpha, {
    workspaceId: "ws-1",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-02T00:00:00.000Z",
    client: mockClient,
    db,
  });

  assert.equal(result.totalFound, 1);
  assert.equal(result.imported, 0);
  assert.equal(result.unmappedProject, 1);
  assert.equal(result.unmapped, 1);
  // Strictly 0 time entries created - never assigned to a default project!
  assert.equal(timeEntries.size, 0);
  assert.ok(result.errors.some((e) => e.includes("is not mapped to any WorkLens project")));
});


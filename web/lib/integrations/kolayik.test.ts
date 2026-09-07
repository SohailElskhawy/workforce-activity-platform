import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { encryptJson } from "@/lib/crypto/secret";
import type {
  KolayIkClient,
  KolayIkLeave,
  KolayIkPerson,
  KolayIkUnit,
} from "@/lib/integrations/kolayik/client";
import {
  mapKolayIkStatus,
  syncKolayIkInbound,
  type KolayIkSyncDatabase,
} from "@/lib/integrations/kolayik/sync";
import type {
  IntegrationMappingRecord,
  IntegrationRecord,
} from "@/lib/services/integrations";
import type { EmployeeStatus } from "@/src/generated/prisma/client";

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

function createMockKolayIkDatabase() {
  const integrations = new Map<string, IntegrationRecord>();
  const mappings = new Map<string, IntegrationMappingRecord>();
  const departments = new Map<string, { id: string; name: string; companyId: string }>();
  const employees = new Map<
    string,
    {
      id: string;
      companyId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
      position?: string | null;
      departmentId?: string | null;
      status: EmployeeStatus;
      hireDate?: Date | null;
    }
  >();
  const leaves = new Map<
    string,
    {
      id: string;
      companyId: string;
      employeeId: string;
      leaveType: string;
      startDate: Date;
      endDate: Date;
      days?: number | null;
      status: string;
      notes?: string | null;
      externalId: string;
    }
  >();

  const db: KolayIkSyncDatabase = {
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
        provider: "KOLAY_IK",
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
    async findDepartmentByName(companyId, name) {
      for (const d of departments.values()) {
        if (d.companyId === companyId && d.name.toLowerCase() === name.toLowerCase()) {
          return { id: d.id, name: d.name };
        }
      }
      return null;
    },
    async createDepartment(data) {
      const id = `dept-${departments.size + 1}`;
      departments.set(id, { id, name: data.name, companyId: data.companyId });
      return { id, name: data.name };
    },
    async updateDepartment(id, data) {
      const d = departments.get(id);
      if (!d) throw new Error("Department not found");
      departments.set(id, { ...d, name: data.name });
      return { id, name: data.name };
    },
    async findEmployeeByEmail(companyId, email) {
      for (const e of employees.values()) {
        if (e.companyId === companyId && e.email.toLowerCase() === email.toLowerCase()) {
          return { id: e.id, email: e.email };
        }
      }
      return null;
    },
    async findEmployeeById(companyId, id) {
      const e = employees.get(id);
      if (!e || e.companyId !== companyId) return null;
      return { id: e.id, email: e.email };
    },
    async createEmployee(data) {
      const id = `emp-${employees.size + 1}`;
      employees.set(id, { ...data, id });
      return { id };
    },
    async updateEmployee(id, data) {
      const e = employees.get(id);
      if (!e) throw new Error("Employee not found");
      employees.set(id, { ...e, ...data });
      return { id };
    },
    async findLeaveByExternalId(companyId, externalId) {
      for (const l of leaves.values()) {
        if (l.companyId === companyId && l.externalId === externalId) {
          return { id: l.id };
        }
      }
      return null;
    },
    async upsertEmployeeLeave(data) {
      for (const [id, l] of leaves.entries()) {
        if (l.companyId === data.companyId && l.externalId === data.externalId) {
          leaves.set(id, { ...l, ...data });
          return { id };
        }
      }
      const id = `leave-${leaves.size + 1}`;
      leaves.set(id, { ...data, id });
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

  return { db, integrations, mappings, departments, employees, leaves };
}

test("Kolay İK status mapper normalizes external HR statuses accurately", () => {
  assert.equal(mapKolayIkStatus("active"), "ACTIVE");
  assert.equal(mapKolayIkStatus("inactive"), "INACTIVE");
  assert.equal(mapKolayIkStatus("terminated"), "INACTIVE");
  assert.equal(mapKolayIkStatus("suspended"), "SUSPENDED");
  assert.equal(mapKolayIkStatus("on_leave"), "SUSPENDED");
  assert.equal(mapKolayIkStatus(undefined), "ACTIVE");
});

test("Kolay İK inbound sync synchronizes departments, employees, positions and leaves idempotently", async () => {
  const { db, integrations, departments, employees, leaves } = createMockKolayIkDatabase();

  integrations.set("comp-alpha", {
    id: "integ-kolayik",
    companyId: "comp-alpha",
    provider: "KOLAY_IK",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiToken: "kolayik_token_123" }),
    config: {},
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockUnits: KolayIkUnit[] = [
    { id: "unit-arch", name: "Architecture & Design" },
  ];

  const mockPersons: KolayIkPerson[] = [
    {
      id: "person-101",
      firstName: "Can",
      lastName: "Demir",
      workEmail: "can.demir@soda.com",
      phone: "+90 555 123 4567",
      title: "Lead BIM Specialist",
      unitId: "unit-arch",
      status: "active",
      hireDate: "2024-01-15T00:00:00.000Z",
    },
  ];

  const mockLeaves: KolayIkLeave[] = [
    {
      id: "leave-501",
      personId: "person-101",
      leaveType: "ANNUAL",
      startDate: "2026-09-10T00:00:00.000Z",
      endDate: "2026-09-15T00:00:00.000Z",
      days: 5,
      status: "approved",
      description: "Annual vacation",
    },
  ];

  const mockClient = {
    async listDepartments() {
      return mockUnits;
    },
    async listEmployees() {
      return mockPersons;
    },
    async listLeaves() {
      return mockLeaves;
    },
  } as unknown as KolayIkClient;

  // 1. Initial Sync
  const result1 = await syncKolayIkInbound(managerAlpha, {
    client: mockClient,
    db,
  });

  assert.equal(result1.departmentsSynced, 1);
  assert.equal(result1.employeesSynced, 1);
  assert.equal(result1.leavesSynced, 1);
  assert.equal(result1.errors.length, 0);

  assert.equal(departments.size, 1);
  assert.equal(employees.size, 1);
  assert.equal(leaves.size, 1);

  const emp = Array.from(employees.values())[0];
  assert.equal(emp.firstName, "Can");
  assert.equal(emp.lastName, "Demir");
  assert.equal(emp.email, "can.demir@soda.com");
  assert.equal(emp.position, "Lead BIM Specialist");
  assert.equal(emp.status, "ACTIVE");

  const leave = Array.from(leaves.values())[0];
  assert.equal(leave.employeeId, emp.id);
  assert.equal(leave.leaveType, "ANNUAL");
  assert.equal(leave.days, 5);
  assert.equal(leave.status, "APPROVED");

  // 2. Second Sync with Updated Title/Status (Idempotent, no duplicate records created!)
  mockPersons[0].title = "Principal BIM Architect";
  mockPersons[0].status = "on_leave";

  const result2 = await syncKolayIkInbound(managerAlpha, {
    client: mockClient,
    db,
  });

  assert.equal(result2.employeesSynced, 1);
  assert.equal(employees.size, 1); // strictly 1 employee preserved!
  assert.equal(departments.size, 1); // strictly 1 department preserved!
  assert.equal(leaves.size, 1); // strictly 1 leave preserved!

  const updatedEmp = Array.from(employees.values())[0];
  assert.equal(updatedEmp.position, "Principal BIM Architect");
  assert.equal(updatedEmp.status, "SUSPENDED");
});

test("Kolay İK tenant isolation: Company A manager cannot sync Company B data", async () => {
  const { db, integrations } = createMockKolayIkDatabase();

  integrations.set("comp-beta", {
    id: "integ-b",
    companyId: "comp-beta",
    provider: "KOLAY_IK",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiToken: "beta_token" }),
    config: {},
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // managerAlpha belongs to comp-alpha, which has no integration configured
  await assert.rejects(
    async () => {
      await syncKolayIkInbound(managerAlpha, { db });
    },
    /Kolay İK integration is not configured/
  );
});

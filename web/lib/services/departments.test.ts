import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import {
  createDepartmentWithStore,
  deleteDepartmentWithStore,
  updateDepartmentWithStore,
  type DepartmentStore,
} from "@/lib/services/departments";

const managerA: AuthContext = {
  companyId: "company-alpha",
  userId: "user-mgr-a",
  employeeId: "emp-mgr-a",
  role: "MANAGER",
};

const employeeA: AuthContext = {
  companyId: "company-alpha",
  userId: "user-emp-a",
  employeeId: "emp-staff-a",
  role: "EMPLOYEE",
};

function createMockStore(initialState?: {
  departments?: Array<{
    id: string;
    name: string;
    managerId: string | null;
    companyId: string;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  employees?: Array<{ id: string; companyId: string }>;
}) {
  const departments = (initialState?.departments ?? []).map((d) => ({
    ...d,
    createdAt: d.createdAt ?? new Date(),
    updatedAt: d.updatedAt ?? new Date(),
  }));
  const employees = [...(initialState?.employees ?? [])];
  const audits: Array<{ action: string; entityId: string; metadata?: import("@/lib/audit/log").AuditMetadata }> = [];
  const unassigned: string[] = [];

  const store: DepartmentStore = {
    async findDepartmentById(id, companyId) {
      const found = departments.find((d) => d.id === id && d.companyId === companyId);
      return found ? { id: found.id, name: found.name, managerId: found.managerId } : null;
    },
    async findDepartmentByName(name, companyId, excludeId) {
      const found = departments.find(
        (d) =>
          d.companyId === companyId &&
          d.name.toLowerCase() === name.toLowerCase() &&
          (!excludeId || d.id !== excludeId),
      );
      return found ? { id: found.id } : null;
    },
    async findEmployeeById(id, companyId) {
      const found = employees.find((e) => e.id === id && e.companyId === companyId);
      return found ? { id: found.id } : null;
    },
    async createDepartment(data) {
      const created = {
        id: `dept-${departments.length + 1}`,
        name: data.name,
        managerId: data.managerId,
        companyId: data.companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      departments.push(created);
      return created;
    },
    async updateDepartment(id, data) {
      const index = departments.findIndex((d) => d.id === id);
      if (index === -1) throw new Error("Department not found in mock store");
      const current = departments[index]!;
      const updated = {
        ...current,
        name: data.name !== undefined ? data.name : current.name,
        managerId: data.managerId !== undefined ? data.managerId : current.managerId,
        createdAt: current.createdAt,
        updatedAt: new Date(),
      };
      departments[index] = updated;
      return updated;
    },
    async deleteDepartment(id) {
      const index = departments.findIndex((d) => d.id === id);
      if (index !== -1) departments.splice(index, 1);
    },
    async unassignDepartmentEmployees(deptId) {
      unassigned.push(deptId);
    },
    async writeAudit(entry) {
      audits.push(entry);
    },
  };

  return { store, departments, audits, unassigned };
}

test("manager can create own-company department and audit log is written", async () => {
  const { store, audits, departments } = createMockStore({
    employees: [{ id: "emp-lead-1", companyId: "company-alpha" }],
  });

  const result = await createDepartmentWithStore(
    managerA,
    { name: "Electrical Design", managerId: "emp-lead-1" },
    store,
  );

  assert.equal(result.name, "Electrical Design");
  assert.equal(result.managerId, "emp-lead-1");
  assert.equal(departments.length, 1);

  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "DEPARTMENT_CREATED");
  assert.equal(audits[0]?.metadata?.name, "Electrical Design");
  assert.equal(audits[0]?.metadata?.managerId, "emp-lead-1");
});

test("employee cannot manage departments (forbidden)", async () => {
  const { store } = createMockStore();

  await assert.rejects(
    () => createDepartmentWithStore(employeeA, { name: "Unauthorized Dept", managerId: null }, store),
    (err: unknown) => err instanceof ApiError && err.code === "FORBIDDEN" && err.status === 403,
  );

  await assert.rejects(
    () => updateDepartmentWithStore(employeeA, "dept-1", { name: "Unauthorized Edit" }, store),
    (err: unknown) => err instanceof ApiError && err.code === "FORBIDDEN" && err.status === 403,
  );

  await assert.rejects(
    () => deleteDepartmentWithStore(employeeA, "dept-1", store),
    (err: unknown) => err instanceof ApiError && err.code === "FORBIDDEN" && err.status === 403,
  );
});

test("duplicate department name within same company is rejected with conflict", async () => {
  const { store } = createMockStore({
    departments: [
      { id: "dept-1", name: "Structural Engineering", managerId: null, companyId: "company-alpha" },
    ],
  });

  await assert.rejects(
    () =>
      createDepartmentWithStore(
        managerA,
        { name: "structural engineering", managerId: null },
        store,
      ),
    (err: unknown) => err instanceof ApiError && err.code === "CONFLICT" && err.status === 409,
  );
});

test("cross-company manager assignment is rejected", async () => {
  const { store } = createMockStore({
    employees: [
      { id: "emp-foreign", companyId: "company-beta" }, // Belongs to different company
    ],
  });

  await assert.rejects(
    () =>
      createDepartmentWithStore(
        managerA,
        { name: "HVAC", managerId: "emp-foreign" },
        store,
      ),
    (err: unknown) => err instanceof ApiError && err.code === "NOT_FOUND" && err.status === 404,
  );
});

test("cross-company department access and update is blocked", async () => {
  const { store } = createMockStore({
    departments: [
      { id: "dept-beta", name: "Beta Dept", managerId: null, companyId: "company-beta" },
    ],
  });

  await assert.rejects(
    () => updateDepartmentWithStore(managerA, "dept-beta", { name: "Hacked Dept" }, store),
    (err: unknown) => err instanceof ApiError && err.code === "NOT_FOUND" && err.status === 404,
  );

  await assert.rejects(
    () => deleteDepartmentWithStore(managerA, "dept-beta", store),
    (err: unknown) => err instanceof ApiError && err.code === "NOT_FOUND" && err.status === 404,
  );
});

test("manager update emits DEPARTMENT_UPDATED and DEPARTMENT_MANAGER_CHANGED audits", async () => {
  const { store, audits } = createMockStore({
    departments: [
      { id: "dept-1", name: "Drafting", managerId: "emp-mgr-1", companyId: "company-alpha" },
    ],
    employees: [
      { id: "emp-mgr-1", companyId: "company-alpha" },
      { id: "emp-mgr-2", companyId: "company-alpha" },
    ],
  });

  const updated = await updateDepartmentWithStore(
    managerA,
    "dept-1",
    { name: "CAD Drafting", managerId: "emp-mgr-2" },
    store,
  );

  assert.equal(updated.name, "CAD Drafting");
  assert.equal(updated.managerId, "emp-mgr-2");

  assert.equal(audits.length, 2);
  assert.equal(audits[0]?.action, "DEPARTMENT_UPDATED");
  assert.equal(audits[1]?.action, "DEPARTMENT_MANAGER_CHANGED");
  assert.equal(audits[1]?.metadata?.previousManagerId, "emp-mgr-1");
  assert.equal(audits[1]?.metadata?.newManagerId, "emp-mgr-2");
});

test("unassigning department manager sets managerId to null and logs manager change", async () => {
  const { store, audits } = createMockStore({
    departments: [
      { id: "dept-1", name: "Drafting", managerId: "emp-mgr-1", companyId: "company-alpha" },
    ],
  });

  const updated = await updateDepartmentWithStore(
    managerA,
    "dept-1",
    { managerId: null },
    store,
  );

  assert.equal(updated.managerId, null);
  const managerAudit = audits.find((a) => a.action === "DEPARTMENT_MANAGER_CHANGED");
  assert.ok(managerAudit);
  assert.equal(managerAudit.metadata?.previousManagerId, "emp-mgr-1");
  assert.equal(managerAudit.metadata?.newManagerId, null);
});

test("deleteDepartment unassigns employees and logs DEPARTMENT_DELETED", async () => {
  const { store, audits, unassigned, departments } = createMockStore({
    departments: [
      { id: "dept-1", name: "To Delete", managerId: null, companyId: "company-alpha" },
    ],
  });

  await deleteDepartmentWithStore(managerA, "dept-1", store);

  assert.equal(departments.length, 0);
  assert.deepEqual(unassigned, ["dept-1"]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "DEPARTMENT_DELETED");
});

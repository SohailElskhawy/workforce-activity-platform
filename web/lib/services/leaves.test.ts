import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import {
  createEmployeeLeaveWithStore,
  deleteEmployeeLeaveWithStore,
  listEmployeeLeavesWithStore,
  listOwnEmployeeLeavesWithStore,
  updateEmployeeLeaveWithStore,
  type EmployeeLeaveStore,
} from "@/lib/services/leaves";

const manager: AuthContext = {
  companyId: "company-alpha",
  employeeId: "employee-manager",
  role: "MANAGER",
  userId: "user-manager",
};
const employee: AuthContext = {
  companyId: "company-alpha",
  employeeId: "employee-a",
  role: "EMPLOYEE",
  userId: "user-employee-a",
};

function createStore(seed?: {
  employees?: Array<{ companyId: string; id: string; name: string }>;
  leaves?: Array<{
    companyId: string;
    employeeId: string;
    endDate: Date;
    id: string;
    leaveType: string;
    notes: string | null;
    startDate: Date;
    status: string;
  }>;
}) {
  const employees = [...(seed?.employees ?? [])];
  const leaves = [...(seed?.leaves ?? [])];
  const audits: Array<{ action: string; entityId: string }> = [];
  const store: EmployeeLeaveStore = {
    async findEmployee(id, companyId) {
      return employees.find((candidate) => candidate.id === id && candidate.companyId === companyId) ?? null;
    },
    async findLeave(id, companyId) {
      return leaves.find((leave) => leave.id === id && leave.companyId === companyId) ?? null;
    },
    async listLeaves(companyId, employeeId) {
      return leaves.filter(
        (leave) => leave.companyId === companyId && (!employeeId || leave.employeeId === employeeId),
      );
    },
    async createLeave(data) {
      const leave = { id: `leave-${leaves.length + 1}`, ...data };
      leaves.push(leave);
      return leave;
    },
    async updateLeave(id, data) {
      const index = leaves.findIndex((leave) => leave.id === id);
      if (index === -1) throw new Error("Leave not found");
      leaves[index] = { ...leaves[index]!, ...data };
      return leaves[index]!;
    },
    async deleteLeave(id) {
      const index = leaves.findIndex((leave) => leave.id === id);
      if (index !== -1) leaves.splice(index, 1);
    },
    async writeAudit(entry) {
      audits.push({ action: entry.action, entityId: entry.entityId });
    },
  };
  return { audits, leaves, store };
}

test("manager creates a leave record only for an employee in their company and audit is written", async () => {
  const { audits, leaves, store } = createStore({
    employees: [{ companyId: "company-alpha", id: "employee-a", name: "Ada Lovelace" }],
  });
  const created = await createEmployeeLeaveWithStore(
    manager,
    {
      employeeId: "employee-a",
      endDate: new Date("2026-09-12T00:00:00.000Z"),
      leaveType: "Annual Leave",
      notes: null,
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      status: "APPROVED",
    },
    store,
  );
  assert.equal(created.companyId, "company-alpha");
  assert.equal(leaves.length, 1);
  assert.deepEqual(audits, [{ action: "EMPLOYEE_LEAVE_CREATED", entityId: created.id }]);

  await assert.rejects(
    () =>
      createEmployeeLeaveWithStore(
        manager,
        {
          employeeId: "employee-foreign",
          endDate: new Date("2026-09-12T00:00:00.000Z"),
          leaveType: "Annual Leave",
          notes: null,
          startDate: new Date("2026-09-10T00:00:00.000Z"),
          status: "APPROVED",
        },
        store,
      ),
    (error: unknown) => error instanceof ApiError && error.code === "NOT_FOUND",
  );
});

test("employee leave reads derive ownership from context and manager reads stay tenant scoped", async () => {
  const { store } = createStore({
    leaves: [
      {
        companyId: "company-alpha",
        employeeId: "employee-a",
        endDate: new Date("2026-09-12"),
        id: "leave-own",
        leaveType: "Annual Leave",
        notes: null,
        startDate: new Date("2026-09-10"),
        status: "APPROVED",
      },
      {
        companyId: "company-alpha",
        employeeId: "employee-b",
        endDate: new Date("2026-10-12"),
        id: "leave-colleague",
        leaveType: "Sick Leave",
        notes: null,
        startDate: new Date("2026-10-10"),
        status: "PENDING",
      },
      {
        companyId: "company-beta",
        employeeId: "employee-foreign",
        endDate: new Date("2026-10-12"),
        id: "leave-foreign",
        leaveType: "Annual Leave",
        notes: null,
        startDate: new Date("2026-10-10"),
        status: "APPROVED",
      },
    ],
  });
  assert.deepEqual(
    (await listOwnEmployeeLeavesWithStore(employee, store)).map((leave) => leave.id),
    ["leave-own"],
  );
  assert.deepEqual(
    (await listEmployeeLeavesWithStore(manager, store)).map((leave) => leave.id),
    ["leave-own", "leave-colleague"],
  );
  await assert.rejects(
    () => listEmployeeLeavesWithStore(employee, store),
    (error: unknown) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
});

test("leave update protects tenant ownership and rejects a resulting inverted date range", async () => {
  const { audits, leaves, store } = createStore({
    leaves: [
      {
        companyId: "company-alpha",
        employeeId: "employee-a",
        endDate: new Date("2026-09-12T00:00:00.000Z"),
        id: "leave-1",
        leaveType: "Annual Leave",
        notes: null,
        startDate: new Date("2026-09-10T00:00:00.000Z"),
        status: "APPROVED",
      },
    ],
  });
  await assert.rejects(
    () =>
      updateEmployeeLeaveWithStore(
        manager,
        "leave-1",
        { startDate: new Date("2026-09-13T00:00:00.000Z") },
        store,
      ),
    (error: unknown) => error instanceof ApiError && error.code === "VALIDATION_ERROR",
  );
  await updateEmployeeLeaveWithStore(manager, "leave-1", { status: "CANCELLED" }, store);
  assert.equal(leaves[0]?.status, "CANCELLED");
  await deleteEmployeeLeaveWithStore(manager, "leave-1", store);
  assert.deepEqual(
    audits.map((audit) => audit.action),
    ["EMPLOYEE_LEAVE_UPDATED", "EMPLOYEE_LEAVE_DELETED"],
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import bcrypt from "bcryptjs";

import type { AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import {
  createEmployee,
  type EmployeeCreationStore,
} from "@/lib/services/employees";
import type { CreateEmployeeInput } from "@/lib/validation/employees";

const manager: AuthContext = {
  companyId: "company-1",
  employeeId: "manager-employee-1",
  role: "MANAGER",
  userId: "manager-user-1",
};

const input: CreateEmployeeInput = {
  departmentId: "department-1",
  email: "ada@example.test",
  firstName: "Ada",
  lastName: "Lovelace",
  position: "Analyst",
  temporaryPassword: "Temporary1!",
};

function createStore(departmentCompanyId = "company-1") {
  const rows: {
    employee: Record<string, unknown> | null;
    user: Record<string, unknown> | null;
  } = {
    employee: null,
    user: null,
  };
  let auditedEmployeeId: string | null = null;
  const store: EmployeeCreationStore = {
    async createEmployeeWithLogin(data) {
      rows.employee = data.employee;
      rows.user = data.user;
      return { email: data.employee.email, id: "employee-1" };
    },
    async findDepartmentById(id) {
      return id === "department-1" ? { companyId: departmentCompanyId } : null;
    },
    async writeAudit(employee) {
      auditedEmployeeId = employee.id;
    },
  };
  return { getAuditedEmployeeId: () => auditedEmployeeId, rows, store };
}

test("createEmployee creates an active employee and linked hashed employee login", async () => {
  const { getAuditedEmployeeId, rows, store } = createStore();

  const created = await createEmployee(manager, input, store);

  assert.deepEqual(created, { email: "ada@example.test", id: "employee-1" });
  assert.equal(rows.employee?.companyId, "company-1");
  assert.equal(rows.employee?.status, "ACTIVE");
  assert.equal(rows.user?.companyId, "company-1");
  assert.equal(rows.user?.role, "EMPLOYEE");
  assert.equal(
    await bcrypt.compare(
      input.temporaryPassword,
      String(rows.user?.passwordHash),
    ),
    true,
  );
  assert.equal(getAuditedEmployeeId(), "employee-1");
});

test("createEmployee rejects a department from another company", async () => {
  const { store } = createStore("company-2");

  await assert.rejects(
    () => createEmployee(manager, input, store),
    (error) => error instanceof ApiError && error.status === 404,
  );
});

import bcrypt from "bcryptjs";

import type { AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import type { CreateEmployeeInput } from "@/lib/validation/employees";

type NewEmployee = {
  companyId: string;
  departmentId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  position: string | undefined;
  status: "ACTIVE";
};

type NewEmployeeLogin = {
  companyId: string;
  email: string;
  passwordHash: string;
  role: "EMPLOYEE";
};

export type EmployeeCreationStore = {
  findDepartmentById(id: string): Promise<{ companyId: string } | null>;
  createEmployeeWithLogin(data: {
    employee: NewEmployee;
    user: NewEmployeeLogin;
  }): Promise<{ id: string; email: string }>;
  writeAudit(employee: { id: string; email: string }): Promise<void>;
};

export async function createEmployeeWithStore(
  context: AuthContext,
  input: CreateEmployeeInput,
  store: EmployeeCreationStore,
) {
  if (input.departmentId) {
    const department = await store.findDepartmentById(input.departmentId);
    if (!department || department.companyId !== context.companyId) {
      throw new ApiError("NOT_FOUND", "Department not found.", 404);
    }
  }

  const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
  const employee = await store.createEmployeeWithLogin({
    employee: {
      companyId: context.companyId,
      departmentId: input.departmentId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      position: input.position,
      status: "ACTIVE",
    },
    user: {
      companyId: context.companyId,
      email: input.email,
      passwordHash,
      role: "EMPLOYEE",
    },
  });
  await store.writeAudit(employee);
  return employee;
}

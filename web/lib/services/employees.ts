import "server-only";

import bcrypt from "bcryptjs";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaErrorWithCode } from "@/lib/services/shared";
import type { CreateEmployeeInput } from "@/lib/validation/employees";

export type AgentConnectionStatus = "NOT_ENROLLED" | "OFFLINE" | "ONLINE";

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

export function getAgentConnectionStatus(
  lastSeenAt: Date | null,
  now = new Date(),
): AgentConnectionStatus {
  if (!lastSeenAt) return "NOT_ENROLLED";
  return lastSeenAt.getTime() >= now.getTime() - 90_000 ? "ONLINE" : "OFFLINE";
}

export async function listDepartments(context: AuthContext) {
  return prisma.department.findMany({
    where: tenantWhere(context.companyId, {}),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function createEmployeeWithStore(
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

export async function createEmployee(
  context: AuthContext,
  input: CreateEmployeeInput,
  store?: EmployeeCreationStore,
) {
  if (store) return createEmployeeWithStore(context, input, store);

  try {
    return await prisma.$transaction(async (transaction) =>
      createEmployeeWithStore(context, input, {
        async createEmployeeWithLogin(data) {
          return transaction.employee.create({
            data: {
              ...data.employee,
              user: { create: data.user },
            },
            select: { email: true, id: true },
          });
        },
        async findDepartmentById(id) {
          return transaction.department.findUnique({
            where: { id },
            select: { companyId: true },
          });
        },
        async writeAudit(employee) {
          await writeAudit(transaction, {
            action: "EMPLOYEE_CREATED",
            actorUserId: context.userId,
            companyId: context.companyId,
            entityId: employee.id,
            entityType: "Employee",
            metadata: { email: employee.email },
          });
        },
      }),
    );
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      throw new ApiError(
        "CONFLICT",
        "An employee with this email already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function listEmployees(context: AuthContext) {
  const employees = await prisma.employee.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      position: true,
      status: true,
      department: { select: { name: true } },
      devices: {
        select: { lastSeenAt: true, name: true },
        orderBy: { lastSeenAt: "desc" },
        take: 1,
      },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return employees.map(({ devices, ...employee }) => {
    const device = devices[0] ?? null;
    return {
      ...employee,
      agentDeviceName: device?.name ?? null,
      agentStatus: getAgentConnectionStatus(device?.lastSeenAt ?? null),
    };
  });
}

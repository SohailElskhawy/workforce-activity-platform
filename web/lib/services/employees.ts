import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { createEmployeeWithStore } from "@/lib/services/employee-creation";
import { getAgentConnectionStatus } from "@/lib/services/employee-presentation";
import { isPrismaErrorWithCode } from "@/lib/services/shared";
import type { CreateEmployeeInput } from "@/lib/validation/employees";

export async function listDepartments(context: AuthContext) {
  return prisma.department.findMany({
    where: tenantWhere(context.companyId, {}),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createEmployee(
  context: AuthContext,
  input: CreateEmployeeInput,
  store?: import("@/lib/services/employee-creation").EmployeeCreationStore,
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

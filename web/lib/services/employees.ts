import "server-only";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { createEmployeeWithStore } from "@/lib/services/employee-creation";
import { getAgentConnectionStatus } from "@/lib/services/employee-presentation";
import { isPrismaErrorWithCode } from "@/lib/services/shared";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@/lib/validation/employees";

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

export async function getEmployee(context: AuthContext, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: tenantWhere(context.companyId, { id: employeeId }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      position: true,
      status: true,
      departmentId: true,
      managerId: true,
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!employee) {
    throw new ApiError("NOT_FOUND", "Employee not found.", 404);
  }

  return employee;
}

export async function updateEmployee(
  context: AuthContext,
  employeeId: string,
  input: UpdateEmployeeInput,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.employee.findFirst({
        where: tenantWhere(context.companyId, { id: employeeId }),
        include: { user: { select: { id: true, email: true } } },
      });

      if (!existing) {
        throw new ApiError("NOT_FOUND", "Employee not found.", 404);
      }

      if (input.departmentId) {
        const department = await transaction.department.findFirst({
          where: tenantWhere(context.companyId, { id: input.departmentId }),
          select: { id: true },
        });
        if (!department) {
          throw new ApiError("NOT_FOUND", "Department not found.", 404);
        }
      }

      if (input.managerId) {
        if (input.managerId === employeeId) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "An employee cannot be their own manager.",
            400,
          );
        }
        const manager = await transaction.employee.findFirst({
          where: tenantWhere(context.companyId, { id: input.managerId }),
          select: { id: true },
        });
        if (!manager) {
          throw new ApiError("NOT_FOUND", "Manager employee not found.", 404);
        }
      }

      const emailChanged = input.email && input.email !== existing.email;
      if (emailChanged) {
        const duplicateEmployee = await transaction.employee.findFirst({
          where: {
            companyId: context.companyId,
            email: input.email,
            id: { not: employeeId },
          },
          select: { id: true },
        });
        if (duplicateEmployee) {
          throw new ApiError(
            "CONFLICT",
            "An employee with this email already exists in your company.",
            409,
          );
        }

        const duplicateUser = await transaction.user.findFirst({
          where: {
            email: input.email,
            employeeId: { not: employeeId },
          },
          select: { id: true },
        });
        if (duplicateUser) {
          throw new ApiError(
            "CONFLICT",
            "A user with this email address already exists.",
            409,
          );
        }

        if (existing.user) {
          await transaction.user.update({
            where: { id: existing.user.id },
            data: { email: input.email },
          });
        }
      }

      const statusChanged = input.status && input.status !== existing.status;
      if (input.status && input.status !== "ACTIVE") {
        await transaction.device.updateMany({
          where: {
            companyId: context.companyId,
            employeeId: employeeId,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      const updated = await transaction.employee.update({
        where: { id: employeeId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          departmentId: input.departmentId,
          position: input.position,
          managerId: input.managerId,
          status: input.status,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          position: true,
          status: true,
          departmentId: true,
          managerId: true,
        },
      });

      await writeAudit(transaction, {
        companyId: context.companyId,
        actorUserId: context.userId,
        action: "EMPLOYEE_UPDATED",
        entityType: "Employee",
        entityId: updated.id,
        metadata: {
          changedFields: Object.keys(input).join(","),
          status: updated.status,
        },
      });

      if (statusChanged) {
        await writeAudit(transaction, {
          companyId: context.companyId,
          actorUserId: context.userId,
          action: "EMPLOYEE_STATUS_CHANGED",
          entityType: "Employee",
          entityId: updated.id,
          metadata: {
            previousStatus: existing.status,
            newStatus: updated.status,
          },
        });
      }

      return updated;
    });
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


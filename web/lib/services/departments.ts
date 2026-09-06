import { assertRole, tenantWhere, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditMetadata } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaErrorWithCode } from "@/lib/services/shared";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "@/lib/validation/departments";

export type DepartmentStore = {
  findDepartmentById(
    id: string,
    companyId: string,
  ): Promise<{ id: string; name: string; managerId: string | null } | null>;
  findDepartmentByName(
    name: string,
    companyId: string,
    excludeId?: string,
  ): Promise<{ id: string } | null>;
  findEmployeeById(
    id: string,
    companyId: string,
  ): Promise<{ id: string } | null>;
  createDepartment(data: {
    companyId: string;
    name: string;
    managerId: string | null;
  }): Promise<{
    id: string;
    name: string;
    managerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  updateDepartment(
    id: string,
    data: { name?: string; managerId?: string | null },
  ): Promise<{
    id: string;
    name: string;
    managerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  deleteDepartment(id: string): Promise<void>;
  unassignDepartmentEmployees(departmentId: string, companyId: string): Promise<void>;
  writeAudit(entry: {
    action: string;
    entityId: string;
    metadata?: AuditMetadata;
  }): Promise<void>;
};

export async function createDepartmentWithStore(
  context: AuthContext,
  input: CreateDepartmentInput,
  store: DepartmentStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  if (input.managerId) {
    const manager = await store.findEmployeeById(input.managerId, context.companyId);
    if (!manager) {
      throw new ApiError(
        "NOT_FOUND",
        "Manager employee not found in your company.",
        404,
      );
    }
  }

  const existing = await store.findDepartmentByName(input.name, context.companyId);
  if (existing) {
    throw new ApiError(
      "CONFLICT",
      "A department with this name already exists in your company.",
      409,
    );
  }

  const department = await store.createDepartment({
    companyId: context.companyId,
    name: input.name,
    managerId: input.managerId ?? null,
  });

  await store.writeAudit({
    action: "DEPARTMENT_CREATED",
    entityId: department.id,
    metadata: {
      name: department.name,
      managerId: department.managerId,
    },
  });

  return department;
}

export async function updateDepartmentWithStore(
  context: AuthContext,
  departmentId: string,
  input: UpdateDepartmentInput,
  store: DepartmentStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const existing = await store.findDepartmentById(departmentId, context.companyId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Department not found.", 404);
  }

  if (input.managerId !== undefined && input.managerId !== null) {
    const manager = await store.findEmployeeById(input.managerId, context.companyId);
    if (!manager) {
      throw new ApiError(
        "NOT_FOUND",
        "Manager employee not found in your company.",
        404,
      );
    }
  }

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await store.findDepartmentByName(
      input.name,
      context.companyId,
      departmentId,
    );
    if (duplicate) {
      throw new ApiError(
        "CONFLICT",
        "A department with this name already exists in your company.",
        409,
      );
    }
  }

  const updated = await store.updateDepartment(departmentId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
  });

  await store.writeAudit({
    action: "DEPARTMENT_UPDATED",
    entityId: updated.id,
    metadata: {
      changedFields: Object.keys(input).join(","),
      previousName: existing.name,
      newName: updated.name,
    },
  });

  const managerChanged =
    input.managerId !== undefined && input.managerId !== existing.managerId;
  if (managerChanged) {
    await store.writeAudit({
      action: "DEPARTMENT_MANAGER_CHANGED",
      entityId: updated.id,
      metadata: {
        previousManagerId: existing.managerId,
        newManagerId: updated.managerId,
      },
    });
  }

  return updated;
}

export async function deleteDepartmentWithStore(
  context: AuthContext,
  departmentId: string,
  store: DepartmentStore,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const existing = await store.findDepartmentById(departmentId, context.companyId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Department not found.", 404);
  }

  await store.unassignDepartmentEmployees(departmentId, context.companyId);
  await store.deleteDepartment(departmentId);

  await store.writeAudit({
    action: "DEPARTMENT_DELETED",
    entityId: departmentId,
    metadata: {
      name: existing.name,
    },
  });

  return { success: true };
}

export async function listDepartmentsWithDetails(context: AuthContext) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  return prisma.department.findMany({
    where: tenantWhere(context.companyId, {}),
    select: {
      id: true,
      name: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
        },
      },
      _count: {
        select: {
          employees: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getDepartment(context: AuthContext, departmentId: string) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const department = await prisma.department.findFirst({
    where: tenantWhere(context.companyId, { id: departmentId }),
    select: {
      id: true,
      name: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
        },
      },
      employees: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          status: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });

  if (!department) {
    throw new ApiError("NOT_FOUND", "Department not found.", 404);
  }

  return department;
}

export async function createDepartment(
  context: AuthContext,
  input: CreateDepartmentInput,
  store?: DepartmentStore,
) {
  if (store) return createDepartmentWithStore(context, input, store);

  try {
    return await prisma.$transaction(async (tx) =>
      createDepartmentWithStore(context, input, {
        async findDepartmentById(id, companyId) {
          return tx.department.findFirst({
            where: tenantWhere(companyId, { id }),
            select: { id: true, name: true, managerId: true },
          });
        },
        async findDepartmentByName(name, companyId, excludeId) {
          return tx.department.findFirst({
            where: {
              companyId,
              name: { equals: name, mode: "insensitive" },
              ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: { id: true },
          });
        },
        async findEmployeeById(id, companyId) {
          return tx.employee.findFirst({
            where: tenantWhere(companyId, { id }),
            select: { id: true },
          });
        },
        async createDepartment(data) {
          return tx.department.create({
            data: {
              name: data.name,
              managerId: data.managerId,
              companyId: data.companyId,
            },
            select: {
              id: true,
              name: true,
              managerId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        async updateDepartment(id, data) {
          return tx.department.update({
            where: { id },
            data,
            select: {
              id: true,
              name: true,
              managerId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        async deleteDepartment(id) {
          await tx.department.delete({ where: { id } });
        },
        async unassignDepartmentEmployees(departmentId, companyId) {
          await tx.employee.updateMany({
            where: { departmentId, companyId },
            data: { departmentId: null },
          });
        },
        async writeAudit(entry) {
          await writeAudit(tx, {
            companyId: context.companyId,
            actorUserId: context.userId,
            action: entry.action,
            entityType: "Department",
            entityId: entry.entityId,
            metadata: entry.metadata,
          });
        },
      }),
    );
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      throw new ApiError(
        "CONFLICT",
        "A department with this name already exists in your company.",
        409,
      );
    }
    throw error;
  }
}

export async function updateDepartment(
  context: AuthContext,
  departmentId: string,
  input: UpdateDepartmentInput,
  store?: DepartmentStore,
) {
  if (store) {
    return updateDepartmentWithStore(context, departmentId, input, store);
  }

  try {
    return await prisma.$transaction(async (tx) =>
      updateDepartmentWithStore(context, departmentId, input, {
        async findDepartmentById(id, companyId) {
          return tx.department.findFirst({
            where: tenantWhere(companyId, { id }),
            select: { id: true, name: true, managerId: true },
          });
        },
        async findDepartmentByName(name, companyId, excludeId) {
          return tx.department.findFirst({
            where: {
              companyId,
              name: { equals: name, mode: "insensitive" },
              ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: { id: true },
          });
        },
        async findEmployeeById(id, companyId) {
          return tx.employee.findFirst({
            where: tenantWhere(companyId, { id }),
            select: { id: true },
          });
        },
        async createDepartment(data) {
          return tx.department.create({
            data: {
              name: data.name,
              managerId: data.managerId,
              companyId: data.companyId,
            },
            select: {
              id: true,
              name: true,
              managerId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        async updateDepartment(id, data) {
          return tx.department.update({
            where: { id },
            data,
            select: {
              id: true,
              name: true,
              managerId: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        async deleteDepartment(id) {
          await tx.department.delete({ where: { id } });
        },
        async unassignDepartmentEmployees(departmentId, companyId) {
          await tx.employee.updateMany({
            where: { departmentId, companyId },
            data: { departmentId: null },
          });
        },
        async writeAudit(entry) {
          await writeAudit(tx, {
            companyId: context.companyId,
            actorUserId: context.userId,
            action: entry.action,
            entityType: "Department",
            entityId: entry.entityId,
            metadata: entry.metadata,
          });
        },
      }),
    );
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2002")) {
      throw new ApiError(
        "CONFLICT",
        "A department with this name already exists in your company.",
        409,
      );
    }
    throw error;
  }
}

export async function deleteDepartment(
  context: AuthContext,
  departmentId: string,
  store?: DepartmentStore,
) {
  if (store) {
    return deleteDepartmentWithStore(context, departmentId, store);
  }

  return prisma.$transaction(async (tx) =>
    deleteDepartmentWithStore(context, departmentId, {
      async findDepartmentById(id, companyId) {
        return tx.department.findFirst({
          where: tenantWhere(companyId, { id }),
          select: { id: true, name: true, managerId: true },
        });
      },
      async findDepartmentByName(name, companyId, excludeId) {
        return tx.department.findFirst({
          where: {
            companyId,
            name: { equals: name, mode: "insensitive" },
            ...(excludeId ? { id: { not: excludeId } } : {}),
          },
          select: { id: true },
        });
      },
      async findEmployeeById(id, companyId) {
        return tx.employee.findFirst({
          where: tenantWhere(companyId, { id }),
          select: { id: true },
        });
      },
      async createDepartment(data) {
        return tx.department.create({
          data: {
            name: data.name,
            managerId: data.managerId,
            companyId: data.companyId,
          },
          select: {
            id: true,
            name: true,
            managerId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      },
      async updateDepartment(id, data) {
        return tx.department.update({
          where: { id },
          data,
          select: {
            id: true,
            name: true,
            managerId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      },
      async deleteDepartment(id) {
        await tx.department.delete({ where: { id } });
      },
      async unassignDepartmentEmployees(deptId, companyId) {
        await tx.employee.updateMany({
          where: { departmentId: deptId, companyId },
          data: { departmentId: null },
        });
      },
      async writeAudit(entry) {
        await writeAudit(tx, {
          companyId: context.companyId,
          actorUserId: context.userId,
          action: entry.action,
          entityType: "Department",
          entityId: entry.entityId,
          metadata: entry.metadata,
        });
      },
    }),
  );
}

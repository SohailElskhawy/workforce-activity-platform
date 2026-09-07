import { assertRole, type AuthContext } from "@/lib/auth-context";
import { decryptJson } from "@/lib/crypto/secret";
import { prisma } from "@/lib/prisma";
import type {
  KolayIkClient,
  KolayIkLeave,
  KolayIkPerson,
  KolayIkUnit,
} from "@/lib/integrations/kolayik/client";
import { KolayIkClient as DefaultKolayIkClient } from "@/lib/integrations/kolayik/client";
import type {
  IntegrationMappingRecord,
  IntegrationRecord,
} from "@/lib/services/integrations";
import { defaultIntegrationStore } from "@/lib/services/integrations";
import type {
  EmployeeStatus,
  Prisma,
} from "@/src/generated/prisma/client";

export function mapKolayIkStatus(rawStatus?: string): EmployeeStatus {
  const s = (rawStatus || "").trim().toLowerCase();
  if (s === "inactive" || s === "terminated" || s === "resigned") {
    return "INACTIVE";
  }
  if (s === "suspended" || s === "on_leave" || s === "leave") {
    return "SUSPENDED";
  }
  return "ACTIVE";
}

export type KolayIkSyncResult = {
  departmentsSynced: number;
  employeesSynced: number;
  leavesSynced: number;
  unmappedEmployees: number;
  errors: string[];
};

export type KolayIkSyncDatabase = {
  findIntegration(companyId: string): Promise<IntegrationRecord | null>;
  findMapping(
    companyId: string,
    externalType: string,
    externalId: string
  ): Promise<IntegrationMappingRecord | null>;
  upsertMapping(
    companyId: string,
    externalType: string,
    externalId: string,
    internalType: string,
    internalId: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<IntegrationMappingRecord>;
  findDepartmentByName(
    companyId: string,
    name: string
  ): Promise<{ id: string; name: string } | null>;
  createDepartment(data: {
    companyId: string;
    name: string;
  }): Promise<{ id: string; name: string }>;
  updateDepartment(
    id: string,
    data: { name: string }
  ): Promise<{ id: string; name: string }>;
  findEmployeeByEmail(
    companyId: string,
    email: string
  ): Promise<{ id: string; email: string } | null>;
  findEmployeeById(
    companyId: string,
    id: string
  ): Promise<{ id: string; email: string } | null>;
  createEmployee(data: {
    companyId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    position?: string | null;
    departmentId?: string | null;
    status: EmployeeStatus;
    hireDate?: Date | null;
  }): Promise<{ id: string }>;
  updateEmployee(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      position?: string | null;
      departmentId?: string | null;
      status?: EmployeeStatus;
      hireDate?: Date | null;
    }
  ): Promise<{ id: string }>;
  findLeaveByExternalId(
    companyId: string,
    externalId: string
  ): Promise<{ id: string } | null>;
  upsertEmployeeLeave(data: {
    companyId: string;
    employeeId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    days?: number | null;
    status: string;
    notes?: string | null;
    externalId: string;
  }): Promise<{ id: string }>;
  recordSyncStatus(
    companyId: string,
    status: string,
    error?: string | null
  ): Promise<void>;
};

export const defaultKolayIkDatabase: KolayIkSyncDatabase = {
  async findIntegration(companyId) {
    return defaultIntegrationStore.findIntegration(companyId, "KOLAY_IK");
  },
  async findMapping(companyId, externalType, externalId) {
    return defaultIntegrationStore.findMapping(
      companyId,
      "KOLAY_IK",
      externalType,
      externalId
    );
  },
  async upsertMapping(
    companyId,
    externalType,
    externalId,
    internalType,
    internalId,
    metadata
  ) {
    return defaultIntegrationStore.upsertMapping(
      companyId,
      "KOLAY_IK",
      externalType,
      externalId,
      internalType,
      internalId,
      metadata
    );
  },
  async findDepartmentByName(companyId, name) {
    return prisma.department.findUnique({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
      select: { id: true, name: true },
    });
  },
  async createDepartment(data) {
    return prisma.department.create({
      data: {
        companyId: data.companyId,
        name: data.name,
      },
      select: { id: true, name: true },
    });
  },
  async updateDepartment(id, data) {
    return prisma.department.update({
      where: { id },
      data: { name: data.name },
      select: { id: true, name: true },
    });
  },
  async findEmployeeByEmail(companyId, email) {
    return prisma.employee.findFirst({
      where: {
        companyId,
        email: { equals: email.toLowerCase(), mode: "insensitive" },
      },
      select: { id: true, email: true },
    });
  },
  async findEmployeeById(companyId, id) {
    return prisma.employee.findFirst({
      where: { companyId, id },
      select: { id: true, email: true },
    });
  },
  async createEmployee(data) {
    return prisma.employee.create({
      data: {
        companyId: data.companyId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        position: data.position,
        departmentId: data.departmentId,
        status: data.status,
        hireDate: data.hireDate,
      },
      select: { id: true },
    });
  },
  async updateEmployee(id, data) {
    return prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.departmentId !== undefined
          ? { departmentId: data.departmentId }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.hireDate !== undefined ? { hireDate: data.hireDate } : {}),
      },
      select: { id: true },
    });
  },
  async findLeaveByExternalId(companyId, externalId) {
    return prisma.employeeLeave.findFirst({
      where: { companyId, externalId },
      select: { id: true },
    });
  },
  async upsertEmployeeLeave(data) {
    const existing = await prisma.employeeLeave.findFirst({
      where: { companyId: data.companyId, externalId: data.externalId },
      select: { id: true },
    });

    if (existing) {
      return prisma.employeeLeave.update({
        where: { id: existing.id },
        data: {
          leaveType: data.leaveType,
          startDate: data.startDate,
          endDate: data.endDate,
          days: data.days,
          status: data.status,
          notes: data.notes,
        },
        select: { id: true },
      });
    }

    return prisma.employeeLeave.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        days: data.days,
        status: data.status,
        notes: data.notes,
        externalId: data.externalId,
      },
      select: { id: true },
    });
  },
  async recordSyncStatus(companyId, status, error) {
    await defaultIntegrationStore.upsertIntegration(companyId, "KOLAY_IK", {
      status: status as any,
      lastSyncAt: new Date(),
      lastError: error,
    });
  },
};

export async function syncKolayIkInbound(
  context: AuthContext,
  options: {
    client?: KolayIkClient;
    db?: KolayIkSyncDatabase;
  } = {}
): Promise<KolayIkSyncResult> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);
  const db = options.db ?? defaultKolayIkDatabase;

  const integration = await db.findIntegration(context.companyId);
  if (!integration || !integration.encryptedCredentials) {
    throw new Error("Kolay İK integration is not configured");
  }

  const { apiToken } = decryptJson<{ apiToken: string }>(
    integration.encryptedCredentials
  );

  const client = options.client ?? new DefaultKolayIkClient({ apiToken });

  const result: KolayIkSyncResult = {
    departmentsSynced: 0,
    employeesSynced: 0,
    leavesSynced: 0,
    unmappedEmployees: 0,
    errors: [],
  };

  // 1. Sync Departments (Units)
  const unitMap = new Map<string, string>(); // kolayIkUnitId -> departmentId
  try {
    const departments = await client.listDepartments();
    for (const unit of departments) {
      try {
        const mapping = await db.findMapping(
          context.companyId,
          "DEPARTMENT",
          unit.id
        );

        let internalDeptId: string;
        if (mapping) {
          await db.updateDepartment(mapping.internalId, { name: unit.name });
          internalDeptId = mapping.internalId;
        } else {
          const existing = await db.findDepartmentByName(
            context.companyId,
            unit.name
          );
          if (existing) {
            internalDeptId = existing.id;
          } else {
            const created = await db.createDepartment({
              companyId: context.companyId,
              name: unit.name,
            });
            internalDeptId = created.id;
          }

          await db.upsertMapping(
            context.companyId,
            "DEPARTMENT",
            unit.id,
            "Department",
            internalDeptId,
            { name: unit.name } as Prisma.InputJsonValue
          );
        }

        unitMap.set(unit.id, internalDeptId);
        result.departmentsSynced++;
      } catch (deptErr) {
        result.errors.push(
          `Unit ${unit.id} (${unit.name}): ${deptErr instanceof Error ? deptErr.message : String(deptErr)}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Failed to list departments: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 2. Sync Employees (Persons)
  const personMap = new Map<string, string>(); // kolayIkPersonId -> employeeId
  try {
    const persons = await client.listEmployees();
    for (const person of persons) {
      try {
        const targetEmail = (person.workEmail || person.email || "").trim().toLowerCase();
        if (!targetEmail) {
          result.errors.push(`Person ${person.id} has no email; skipped`);
          continue;
        }

        const status = mapKolayIkStatus(person.status);
        const departmentId = person.unitId ? unitMap.get(person.unitId) : null;
        const hireDate = person.hireDate ? new Date(person.hireDate) : null;

        // Check mapping first
        const mapping = await db.findMapping(
          context.companyId,
          "EMPLOYEE",
          person.id
        );

        let internalEmployeeId: string;

        if (mapping) {
          await db.updateEmployee(mapping.internalId, {
            firstName: person.firstName,
            lastName: person.lastName,
            phone: person.phone,
            position: person.title,
            departmentId,
            status,
            hireDate,
          });
          internalEmployeeId = mapping.internalId;
        } else {
          // Check by email
          const existing = await db.findEmployeeByEmail(
            context.companyId,
            targetEmail
          );

          if (existing) {
            await db.updateEmployee(existing.id, {
              firstName: person.firstName,
              lastName: person.lastName,
              phone: person.phone,
              position: person.title,
              departmentId,
              status,
              hireDate,
            });
            internalEmployeeId = existing.id;
          } else {
            const created = await db.createEmployee({
              companyId: context.companyId,
              firstName: person.firstName,
              lastName: person.lastName,
              email: targetEmail,
              phone: person.phone,
              position: person.title,
              departmentId,
              status,
              hireDate,
            });
            internalEmployeeId = created.id;
          }

          await db.upsertMapping(
            context.companyId,
            "EMPLOYEE",
            person.id,
            "Employee",
            internalEmployeeId,
            { email: targetEmail } as Prisma.InputJsonValue
          );
        }

        personMap.set(person.id, internalEmployeeId);
        result.employeesSynced++;
      } catch (personErr) {
        result.errors.push(
          `Person ${person.id} (${person.firstName} ${person.lastName}): ${personErr instanceof Error ? personErr.message : String(personErr)}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Failed to list employees: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 3. Sync Leaves
  try {
    const leaves = await client.listLeaves();
    for (const leave of leaves) {
      try {
        const employeeId = personMap.get(leave.personId);
        if (!employeeId) {
          result.unmappedEmployees++;
          continue;
        }

        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);

        const createdLeave = await db.upsertEmployeeLeave({
          companyId: context.companyId,
          employeeId,
          leaveType: leave.leaveType || "ANNUAL",
          startDate,
          endDate,
          days: leave.days ?? null,
          status: (leave.status || "APPROVED").toUpperCase(),
          notes: leave.description || null,
          externalId: leave.id,
        });

        await db.upsertMapping(
          context.companyId,
          "LEAVE",
          leave.id,
          "EmployeeLeave",
          createdLeave.id,
          {
            startDate: leave.startDate,
            endDate: leave.endDate,
          } as Prisma.InputJsonValue
        );

        result.leavesSynced++;
      } catch (leaveErr) {
        result.errors.push(
          `Leave ${leave.id}: ${leaveErr instanceof Error ? leaveErr.message : String(leaveErr)}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Failed to list leaves: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Update integration lastSyncAt and status
  await db.recordSyncStatus(
    context.companyId,
    "CONNECTED",
    result.errors.length > 0
      ? `${result.employeesSynced} employees, ${result.leavesSynced} leaves synced with ${result.errors.length} warnings`
      : null
  );

  return result;
}

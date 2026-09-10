import { assertRole, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditEntry } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type {
  CreateEmployeeLeaveInput,
  UpdateEmployeeLeaveInput,
} from "@/lib/validation/leaves";

export type EmployeeLeaveRecord = {
  id: string;
  companyId: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  status: string;
  notes: string | null;
  employee?: { firstName: string; lastName: string; email: string };
};

export type EmployeeLeaveStore = {
  findEmployee(
    id: string,
    companyId: string,
  ): Promise<{ id: string; companyId: string; name: string } | null>;
  findLeave(id: string, companyId: string): Promise<EmployeeLeaveRecord | null>;
  listLeaves(companyId: string, employeeId?: string): Promise<EmployeeLeaveRecord[]>;
  createLeave(data: Omit<EmployeeLeaveRecord, "id" | "employee">): Promise<EmployeeLeaveRecord>;
  updateLeave(
    id: string,
    data: Partial<Pick<EmployeeLeaveRecord, "leaveType" | "startDate" | "endDate" | "status" | "notes">>,
  ): Promise<EmployeeLeaveRecord>;
  deleteLeave(id: string): Promise<void>;
  writeAudit(entry: AuditEntry): Promise<void>;
};

const leaveSelect = {
  id: true,
  companyId: true,
  employeeId: true,
  leaveType: true,
  startDate: true,
  endDate: true,
  status: true,
  notes: true,
  employee: { select: { firstName: true, lastName: true, email: true } },
} as const;

export const defaultEmployeeLeaveStore: EmployeeLeaveStore = {
  async findEmployee(id, companyId) {
    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
      select: { id: true, companyId: true, firstName: true, lastName: true },
    });
    return employee
      ? { ...employee, name: `${employee.firstName} ${employee.lastName}`.trim() }
      : null;
  },
  async findLeave(id, companyId) {
    return prisma.employeeLeave.findFirst({
      where: { id, companyId },
      select: leaveSelect,
    });
  },
  async listLeaves(companyId, employeeId) {
    return prisma.employeeLeave.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      select: leaveSelect,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  },
  async createLeave(data) {
    return prisma.employeeLeave.create({ data, select: leaveSelect });
  },
  async updateLeave(id, data) {
    return prisma.employeeLeave.update({ where: { id }, data, select: leaveSelect });
  },
  async deleteLeave(id) {
    await prisma.employeeLeave.delete({ where: { id } });
  },
  async writeAudit(entry) {
    await writeAudit(prisma, entry);
  },
};

function assertValidRange(startDate: Date, endDate: Date) {
  if (endDate < startDate) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "End date must be on or after start date.",
      400,
    );
  }
}

export async function listEmployeeLeavesWithStore(
  context: AuthContext,
  store: EmployeeLeaveStore = defaultEmployeeLeaveStore,
  employeeId?: string,
) {
  assertRole(context, ["MANAGER"]);
  if (employeeId && !(await store.findEmployee(employeeId, context.companyId))) {
    throw new ApiError("NOT_FOUND", "Employee not found.", 404);
  }
  return store.listLeaves(context.companyId, employeeId);
}

export async function listOwnEmployeeLeavesWithStore(
  context: AuthContext,
  store: EmployeeLeaveStore = defaultEmployeeLeaveStore,
) {
  assertRole(context, ["EMPLOYEE"]);
  if (!context.employeeId) {
    throw new ApiError("UNAUTHORIZED", "Employee access is required.", 401);
  }
  return store.listLeaves(context.companyId, context.employeeId);
}

export async function createEmployeeLeaveWithStore(
  context: AuthContext,
  input: CreateEmployeeLeaveInput,
  store: EmployeeLeaveStore = defaultEmployeeLeaveStore,
) {
  assertRole(context, ["MANAGER"]);
  const employee = await store.findEmployee(input.employeeId, context.companyId);
  if (!employee) throw new ApiError("NOT_FOUND", "Employee not found.", 404);
  assertValidRange(input.startDate, input.endDate);

  const leave = await store.createLeave({
    companyId: context.companyId,
    employeeId: employee.id,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status,
    notes: input.notes,
  });
  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "EMPLOYEE_LEAVE_CREATED",
    entityType: "EmployeeLeave",
    entityId: leave.id,
    metadata: { employeeId: leave.employeeId, leaveType: leave.leaveType, status: leave.status },
  });
  return leave;
}

export async function updateEmployeeLeaveWithStore(
  context: AuthContext,
  leaveId: string,
  input: UpdateEmployeeLeaveInput,
  store: EmployeeLeaveStore = defaultEmployeeLeaveStore,
) {
  assertRole(context, ["MANAGER"]);
  const existing = await store.findLeave(leaveId, context.companyId);
  if (!existing) throw new ApiError("NOT_FOUND", "Leave record not found.", 404);
  assertValidRange(input.startDate ?? existing.startDate, input.endDate ?? existing.endDate);

  const leave = await store.updateLeave(leaveId, input);
  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "EMPLOYEE_LEAVE_UPDATED",
    entityType: "EmployeeLeave",
    entityId: leave.id,
    metadata: { employeeId: leave.employeeId, leaveType: leave.leaveType, status: leave.status },
  });
  return leave;
}

export async function deleteEmployeeLeaveWithStore(
  context: AuthContext,
  leaveId: string,
  store: EmployeeLeaveStore = defaultEmployeeLeaveStore,
) {
  assertRole(context, ["MANAGER"]);
  const existing = await store.findLeave(leaveId, context.companyId);
  if (!existing) throw new ApiError("NOT_FOUND", "Leave record not found.", 404);
  await store.deleteLeave(existing.id);
  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "EMPLOYEE_LEAVE_DELETED",
    entityType: "EmployeeLeave",
    entityId: existing.id,
    metadata: { employeeId: existing.employeeId, leaveType: existing.leaveType, status: existing.status },
  });
}

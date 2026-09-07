import bcrypt from "bcryptjs";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/security/session-settings";
import { prisma } from "@/lib/prisma";
import { assertRole, type AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { createEmployeeWithStore } from "@/lib/services/employee-creation";
import { createEmployeeSchema } from "@/lib/validation/employees";
import type { Prisma } from "@/src/generated/prisma/client";
import { safeAuditMetadata } from "./security";
import {
  companySchema,
  createUserSchema,
  updateUserSchema,
  idSchema,
  parse,
  type AdminQuery,
} from "./validation";

export type AdminDatabase = typeof prisma;
const userSelect = {
  id: true,
  email: true,
  role: true,
  companyId: true,
  employeeId: true,
  createdAt: true,
  company: { select: { id: true, name: true } },
  employee: {
    select: { firstName: true, lastName: true, status: true, companyId: true },
  },
} satisfies Prisma.UserSelect;
const companySelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { users: true, employees: true, projects: true, devices: true },
  },
} satisfies Prisma.CompanySelect;
function guard(context: AuthContext) {
  assertRole(context, ["SUPER_ADMIN"]);
}
function pageArgs(query: AdminQuery) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
function missing() {
  return new ApiError("NOT_FOUND", "Administration record not found.", 404);
}
function conflict() {
  return new ApiError(
    "CONFLICT",
    "The change conflicts with an existing account or relationship.",
    409,
  );
}

export async function listAdminCompanies(
  context: AuthContext,
  query: AdminQuery,
  db = prisma,
) {
  guard(context);
  const where: Prisma.CompanyWhereInput = query.q
    ? { name: { contains: query.q, mode: "insensitive" } }
    : {};
  const [items, total] = await Promise.all([
    db.company.findMany({
      where,
      select: companySelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...pageArgs(query),
    }),
    db.company.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
export async function getAdminCompany(
  context: AuthContext,
  id: string,
  db = prisma,
) {
  guard(context);
  parse(idSchema, id);
  const company = await db.company.findUnique({
    where: { id },
    select: {
      ...companySelect,
      trackingSettings: {
        select: {
          idleThresholdSeconds: true,
          configVersion: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          users: true,
          employees: true,
          projects: true,
          devices: true,
          excludedApplications: true,
        },
      },
    },
  });
  if (!company) throw missing();
  return company;
}
export async function saveAdminCompany(
  context: AuthContext,
  id: string | null,
  raw: unknown,
  db = prisma,
) {
  guard(context);
  const input = parse(companySchema, raw);
  if (id !== null) parse(idSchema, id);
  return db.$transaction(async (tx) => {
    if (
      id !== null &&
      !(await tx.company.findUnique({ where: { id }, select: { id: true } }))
    )
      throw missing();
    // Company names are not unique in the existing schema; preserve that behavior.
    const company =
      id !== null
        ? await tx.company.update({
            where: { id },
            data: input,
            select: companySelect,
          })
        : await tx.company.create({ data: input, select: companySelect });
    await writeAudit(tx, {
      companyId: company.id,
      actorUserId: context.userId,
      action: id !== null ? "COMPANY_UPDATED" : "COMPANY_CREATED",
      entityType: "Company",
      entityId: company.id,
    });
    return company;
  });
}
export async function listAdminUsers(
  context: AuthContext,
  query: AdminQuery,
  db = prisma,
) {
  guard(context);
  const where: Prisma.UserWhereInput = {
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" } },
            {
              employee: {
                is: {
                  OR: [
                    { firstName: { contains: query.q, mode: "insensitive" } },
                    { lastName: { contains: query.q, mode: "insensitive" } },
                  ],
                },
              },
            },
            { company: { name: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ email: "asc" }, { id: "asc" }],
      ...pageArgs(query),
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
export async function createAdminUser(
  context: AuthContext,
  raw: unknown,
  db = prisma,
) {
  guard(context);
  const input = parse(createUserSchema, raw);
  try {
    return await db.$transaction(async (tx) => {
      if (
        !(await tx.company.findUnique({
          where: { id: input.companyId },
          select: { id: true },
        }))
      )
        throw missing();
      let user;
      if (input.role === "EMPLOYEE") {
        const employeeInput = parse(createEmployeeSchema, {
          email: input.email,
          temporaryPassword: input.temporaryPassword,
          firstName: input.firstName,
          lastName: input.lastName,
        });
        const employee = await createEmployeeWithStore(
          { ...context, companyId: input.companyId },
          employeeInput,
          {
            findDepartmentById: (id) =>
              tx.department.findUnique({
                where: { id },
                select: { companyId: true },
              }),
            createEmployeeWithLogin: (data) =>
              tx.employee.create({
                data: { ...data.employee, user: { create: data.user } },
                select: { id: true, email: true },
              }),
            writeAudit: (employee) =>
              writeAudit(tx, {
                companyId: input.companyId,
                actorUserId: context.userId,
                action: "EMPLOYEE_CREATED",
                entityType: "Employee",
                entityId: employee.id,
              }),
          },
        );
        user = await tx.user.findUniqueOrThrow({
          where: { employeeId: employee.id },
          select: userSelect,
        });
      } else {
        user = await tx.user.create({
          data: {
            companyId: input.companyId,
            email: input.email,
            role: input.role,
            passwordHash: await bcrypt.hash(input.temporaryPassword, 12),
          },
          select: userSelect,
        });
      }
      await writeAudit(tx, {
        companyId: input.companyId,
        actorUserId: context.userId,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        metadata: { role: user.role },
      });
      return user;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw conflict();
    throw error;
  }
}
export async function updateAdminUser(
  context: AuthContext,
  id: string,
  raw: unknown,
  db = prisma,
) {
  guard(context);
  parse(idSchema, id);
  const input = parse(updateUserSchema, raw);
  try {
    return await db.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({
          where: { id },
          select: {
            ...userSelect,
            _count: {
              select: {
                createdProjects: true,
                createdTasks: true,
                createdAssignments: true,
                createdFileMappings: true,
              },
            },
          },
        });
        if (!existing) throw missing();
        if (
          id === context.userId &&
          (input.role !== existing.role ||
            input.companyId !== existing.companyId)
        )
          throw conflict();
        if (
          !(await tx.company.findUnique({
            where: { id: input.companyId },
            select: { id: true },
          }))
        )
          throw missing();
        if (
          existing.employee &&
          existing.employee.companyId !== input.companyId
        )
          throw conflict();
        if (
          input.role === "EMPLOYEE" &&
          (!existing.employeeId ||
            !existing.employee ||
            existing.employee.status !== "ACTIVE")
        )
          throw conflict();
        if (
          input.companyId !== existing.companyId &&
          (existing.employeeId ||
            Object.values(existing._count).some((count) => count > 0))
        )
          throw conflict();
        const user = await tx.user.update({
          where: { id },
          data: input,
          select: userSelect,
        });
        if (input.role !== existing.role)
          await writeAudit(tx, {
            companyId: existing.companyId,
            actorUserId: context.userId,
            action: "USER_ROLE_CHANGED",
            entityType: "User",
            entityId: id,
            metadata: { previousRole: existing.role, newRole: input.role },
          });
        if (input.companyId !== existing.companyId)
          await writeAudit(tx, {
            companyId: existing.companyId,
            actorUserId: context.userId,
            action: "USER_COMPANY_CHANGED",
            entityType: "User",
            entityId: id,
            metadata: {
              previousCompanyId: existing.companyId,
              newCompanyId: input.companyId,
            },
          });
        return user;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["P2002", "P2034"].includes(String(error.code))
    )
      throw conflict();
    throw error;
  }
}
export async function listAdminLogs(
  context: AuthContext,
  query: AdminQuery,
  db = prisma,
) {
  guard(context);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.actor
      ? {
          OR: [
            { actorUserId: query.actor },
            {
              actor: {
                is: { email: { contains: query.actor, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from + "T00:00:00Z") } : {}),
            ...(query.to
              ? {
                  lt: new Date(
                    new Date(query.to + "T00:00:00Z").getTime() + 86400000,
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
  const [records, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        metadata: true,
        company: { select: { id: true, name: true } },
        actor: { select: { id: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(query),
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    items: records.map((row) => ({
      ...row,
      metadata: safeAuditMetadata(row.metadata),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
export async function adminOverview(context: AuthContext, db = prisma) {
  guard(context);
  const since = new Date(Date.now() - 86400000);
  const [
    companies,
    users,
    employees,
    projects,
    devices,
    activeDevices,
    activeCompanies,
    recent,
  ] = await Promise.all([
    db.company.count(),
    db.user.count(),
    db.employee.count(),
    db.project.count(),
    db.device.count(),
    db.device.count({ where: { isActive: true, lastSeenAt: { gte: since } } }),
    db.company.count({
      where: {
        devices: { some: { isActive: true, lastSeenAt: { gte: since } } },
      },
    }),
    listAdminLogs(context, { page: 1, pageSize: 10 }, db),
  ]);
  return {
    companies,
    users,
    employees,
    projects,
    devices,
    activeDevices,
    activeCompanies,
    recent: recent.items,
  };
}
export function adminIntegrations(context: AuthContext) {
  guard(context);
  return { available: false, items: [] };
}
export function adminSettings(context: AuthContext) {
  guard(context);
  return {
    globalSettingsAvailable: false,
    trackingScope: "COMPANY",
    authentication: "CREDENTIALS",
    sessionHours: SESSION_MAX_AGE_SECONDS / 3600,
  };
}

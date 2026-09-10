import bcrypt from "bcryptjs";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/security/session-settings";
import { prisma } from "@/lib/prisma";
import { assertRole, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditEntry } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { createEmployeeWithStore } from "@/lib/services/employee-creation";
import { createEmployeeSchema } from "@/lib/validation/employees";
import type {
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from "@/src/generated/prisma/client";
import { safeAuditMetadata } from "./security";
import {
  companySchema,
  createUserSchema,
  updateUserSchema,
  idSchema,
  parse,
  type AdminQuery,
} from "./validation";
import { ClickUpClient } from "@/lib/integrations/clickup/client";
import { ClockifyClient } from "@/lib/integrations/clockify/client";
import { KolayIkClient } from "@/lib/integrations/kolayik/client";
import { syncClickUpInbound } from "@/lib/integrations/clickup/sync";
import { importClockifyHistoricalTime } from "@/lib/integrations/clockify/import";
import { syncKolayIkInbound } from "@/lib/integrations/kolayik/sync";
import {
  defaultIntegrationStore,
  getDecryptedCredentialsWithStore,
  configureIntegrationWithStore,
  disconnectIntegrationWithStore,
  recordIntegrationSyncStatusWithStore,
  type IntegrationStore,
  type IntegrationRecord,
} from "@/lib/services/integrations";
import {
  getSystemSettingsWithStore,
  updateSystemSettingsWithStore,
} from "@/lib/services/system-settings";
import { updateSystemSettingsSchema } from "@/lib/validation/system-settings";

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
      integrations: {
        select: {
          id: true,
          provider: true,
          status: true,
          config: true,
          lastSyncAt: true,
          lastError: true,
          updatedAt: true,
        },
        orderBy: { provider: "asc" },
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
            findPositionById: (id) =>
              tx.position.findUnique({
                where: { id },
                select: { companyId: true, name: true },
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
export async function listAdminIntegrations(
  context: AuthContext,
  query: AdminQuery,
  db = prisma,
) {
  guard(context);
  const where: Prisma.IntegrationWhereInput = {
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.provider ? { provider: query.provider as IntegrationProvider } : {}),
    ...(query.status ? { status: query.status as IntegrationStatus } : {}),
    ...(query.q
      ? {
          company: {
            name: { contains: query.q, mode: "insensitive" },
          },
        }
      : {}),
  };

  const [records, total] = await Promise.all([
    db.integration.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        provider: true,
        status: true,
        config: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        encryptedCredentials: true,
      },
      orderBy: [{ company: { name: "asc" } }, { provider: "asc" }],
      ...pageArgs(query),
    }),
    db.integration.count({ where }),
  ]);

  const items = records.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.company.name,
    provider: r.provider,
    status: r.status,
    isConfigured: Boolean(r.encryptedCredentials),
    config: (r.config as Record<string, unknown>) ?? null,
    lastSyncAt: r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
    lastError: r.lastError,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function adminIntegrations(
  context: AuthContext,
  query: AdminQuery = { page: 1, pageSize: 25 },
  db = prisma,
) {
  guard(context);
  return listAdminIntegrations(context, query, db);
}

export async function adminTestIntegration(
  context: AuthContext,
  companyId: string,
  provider: IntegrationProvider,
  db = prisma,
) {
  guard(context);
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw missing();

  const stored = await getDecryptedCredentialsWithStore(companyId, provider);
  if (!stored) {
    throw new ApiError(
      "NOT_FOUND",
      `Integration ${provider} is not configured for this company.`,
      404,
    );
  }

  let message = "";
  try {
    if (provider === "CLICKUP") {
      const token = (stored.credentials as Record<string, unknown>)?.apiToken as
        | string
        | undefined;
      if (!token) throw new Error("No ClickUp API token found");
      const client = new ClickUpClient({ apiToken: token });
      const res = await client.testConnection();
      message = `Connected as ${res.user.username} (${res.user.email})`;
    } else if (provider === "CLOCKIFY") {
      const key = (stored.credentials as Record<string, unknown>)?.apiKey as
        | string
        | undefined;
      if (!key) throw new Error("No Clockify API key found");
      const client = new ClockifyClient({ apiKey: key });
      const res = await client.testConnection();
      message = `Connected as ${res.user.name} (${res.user.email})`;
    } else if (provider === "KOLAY_IK") {
      const token = (stored.credentials as Record<string, unknown>)?.apiToken as
        | string
        | undefined;
      if (!token) throw new Error("No Kolay İK API token found");
      const baseUrl = (stored.config?.apiBaseUrl as string) || undefined;
      const client = new KolayIkClient({ apiToken: token, baseUrl });
      const res = await client.testConnection();
      message = res.message;
    }

    await db.integration.update({
      where: { companyId_provider: { companyId, provider } },
      data: { status: "CONNECTED", lastError: null },
    });

    await writeAudit(db, {
      companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_CONNECTION_TESTED",
      entityType: "Integration",
      entityId: provider,
      metadata: { provider, success: true },
    });

    return { success: true, message };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Connection test failed";
    await db.integration.update({
      where: { companyId_provider: { companyId, provider } },
      data: { status: "ERROR", lastError: errorMessage },
    });

    await writeAudit(db, {
      companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_CONNECTION_TESTED",
      entityType: "Integration",
      entityId: provider,
      metadata: { provider, success: false, error: errorMessage },
    });

    throw new ApiError("VALIDATION_ERROR", errorMessage, 400);
  }
}

function makeDbIntegrationStore(db: AdminDatabase): IntegrationStore {
  const customDb = db as unknown as {
    integration?: {
      findUnique?: (args: unknown) => Promise<IntegrationRecord | null>;
      deleteMany?: (args: unknown) => Promise<unknown>;
      upsert?: (args: unknown) => Promise<IntegrationRecord>;
    };
    auditLog?: {
      create?: (args: unknown) => Promise<unknown>;
    };
  };

  return {
    ...defaultIntegrationStore,
    async findIntegration(cid: string, p: IntegrationProvider) {
      if (!customDb.integration?.findUnique) {
        return defaultIntegrationStore.findIntegration(cid, p);
      }
      return customDb.integration.findUnique({
        where: { companyId_provider: { companyId: cid, provider: p } },
      });
    },
    async upsertIntegration(cid: string, p: IntegrationProvider, data) {
      if (!customDb.integration?.upsert) {
        return defaultIntegrationStore.upsertIntegration(cid, p, data);
      }
      return customDb.integration.upsert({
        where: { companyId_provider: { companyId: cid, provider: p } },
        create: { companyId: cid, provider: p, ...data },
        update: data,
      });
    },
    async deleteIntegration(cid: string, p: IntegrationProvider) {
      if (!customDb.integration?.deleteMany) {
        return defaultIntegrationStore.deleteIntegration(cid, p);
      }
      await customDb.integration.deleteMany({
        where: { companyId: cid, provider: p },
      });
    },
    async writeAudit(entry: AuditEntry) {
      if (customDb.auditLog?.create) {
        await customDb.auditLog.create({ data: entry });
      } else {
        await defaultIntegrationStore.writeAudit(entry);
      }
    },
  };
}

export async function adminConfigureIntegration(
  context: AuthContext,
  companyId: string,
  provider: IntegrationProvider,
  credentials: Record<string, unknown>,
  config?: Record<string, unknown>,
  db: AdminDatabase = prisma,
  store?: IntegrationStore,
) {
  guard(context);
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw missing();

  const companyContext: AuthContext = {
    ...context,
    companyId,
  };
  const resolvedStore =
    store ?? (db !== prisma ? makeDbIntegrationStore(db) : defaultIntegrationStore);
  return configureIntegrationWithStore(
    companyContext,
    provider,
    credentials,
    config,
    resolvedStore,
  );
}

export async function adminDisconnectIntegration(
  context: AuthContext,
  companyId: string,
  provider: IntegrationProvider,
  db: AdminDatabase = prisma,
  store?: IntegrationStore,
) {
  guard(context);
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw missing();

  const companyContext: AuthContext = {
    ...context,
    companyId,
  };
  const resolvedStore =
    store ?? (db !== prisma ? makeDbIntegrationStore(db) : defaultIntegrationStore);
  await disconnectIntegrationWithStore(companyContext, provider, resolvedStore);
  return { success: true };
}

export async function adminSyncIntegration(
  context: AuthContext,
  companyId: string,
  provider: IntegrationProvider,
  payload?: Record<string, unknown>,
  db = prisma,
) {
  guard(context);
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw missing();

  const companyContext: AuthContext = {
    ...context,
    companyId,
  };

  await writeAudit(db, {
    companyId,
    actorUserId: context.userId,
    action: "INTEGRATION_SYNC_STARTED",
    entityType: "Integration",
    entityId: provider,
    metadata: { provider },
  });

  try {
    let syncSummary: Record<string, unknown> = {};
    if (provider === "CLICKUP") {
      const stored = await getDecryptedCredentialsWithStore(companyId, "CLICKUP");
      const config = stored?.config as Record<string, unknown> | null;
      const listId =
        (payload?.listId as string | undefined) ??
        (config?.listId as string | undefined);
      const result = await syncClickUpInbound(companyContext, {
        listId,
      });
      syncSummary = result as unknown as Record<string, unknown>;
    } else if (provider === "CLOCKIFY") {
      const stored = await getDecryptedCredentialsWithStore(companyId, "CLOCKIFY");
      const config = stored?.config as Record<string, unknown> | null;
      const workspaceId =
        (payload?.workspaceId as string | undefined) ??
        (config?.workspaceId as string | undefined) ??
        "";
      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 30 * 86400000).toISOString();
      const defaultEndDate = now.toISOString();
      const startDate =
        (payload?.startDate as string | undefined) ?? defaultStartDate;
      const endDate =
        (payload?.endDate as string | undefined) ?? defaultEndDate;

      const result = await importClockifyHistoricalTime(companyContext, {
        workspaceId,
        startDate,
        endDate,
      });
      syncSummary = result as unknown as Record<string, unknown>;
    } else if (provider === "KOLAY_IK") {
      const result = await syncKolayIkInbound(companyContext);
      syncSummary = result as unknown as Record<string, unknown>;
    }

    await recordIntegrationSyncStatusWithStore(
      companyId,
      provider,
      "CONNECTED",
      null,
    );

    await writeAudit(db, {
      companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_SYNC_COMPLETED",
      entityType: "Integration",
      entityId: provider,
      metadata: { provider, ...syncSummary },
    });

    return { success: true, ...syncSummary };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Sync failed";
    await recordIntegrationSyncStatusWithStore(
      companyId,
      provider,
      "ERROR",
      errorMessage,
    );

    await writeAudit(db, {
      companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_SYNC_FAILED",
      entityType: "Integration",
      entityId: provider,
      metadata: { provider, error: errorMessage },
    });

    throw new ApiError("VALIDATION_ERROR", errorMessage, 400);
  }
}

export async function adminSettings(
  context: AuthContext,
  db: AdminDatabase = prisma,
) {
  guard(context);
  const customDb = db as unknown as {
    systemSettings?: { findUnique?: unknown };
  };
  if (db !== prisma && !customDb?.systemSettings?.findUnique) {
    return {
      globalSettingsAvailable: true,
      notificationDueSoonHours: 24,
      defaultIdleThresholdSeconds: 300,
      trackingScope: "COMPANY",
      authentication: "CREDENTIALS",
      sessionHours: SESSION_MAX_AGE_SECONDS / 3600,
    };
  }
  const settings = await getSystemSettingsWithStore(context);
  return {
    globalSettingsAvailable: true,
    notificationDueSoonHours: settings.notificationDueSoonHours,
    defaultIdleThresholdSeconds: settings.defaultIdleThresholdSeconds,
    trackingScope: "COMPANY",
    authentication: "CREDENTIALS",
    sessionHours: SESSION_MAX_AGE_SECONDS / 3600,
  };
}

export async function updateAdminSettings(
  context: AuthContext,
  raw: unknown,
) {
  guard(context);
  const input = parse(updateSystemSettingsSchema, raw);
  const updated = await updateSystemSettingsWithStore(context, input);
  return {
    globalSettingsAvailable: true,
    notificationDueSoonHours: updated.notificationDueSoonHours,
    defaultIdleThresholdSeconds: updated.defaultIdleThresholdSeconds,
    trackingScope: "COMPANY",
    authentication: "CREDENTIALS",
    sessionHours: SESSION_MAX_AGE_SECONDS / 3600,
  };
}

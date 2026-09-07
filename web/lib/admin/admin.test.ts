import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { type AuthContext, assertRole, tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { resolveSuperAdmin, safeAuditMetadata } from "./security";
import { adminHandler } from "./http";
import {
  parseAdminQuery,
  companySchema,
  createUserSchema,
  updateUserSchema,
} from "./validation";
import {
  adminOverview,
  adminSettings,
  adminIntegrations,
  listAdminCompanies,
  getAdminCompany,
  saveAdminCompany,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  listAdminLogs,
  listAdminIntegrations,
  adminTestIntegration,
  adminConfigureIntegration,
  adminDisconnectIntegration,
  adminSyncIntegration,
  updateAdminSettings,
  type AdminDatabase,
} from "./service";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const uid = "33333333-3333-4333-8333-333333333333";
const admin: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444444",
  companyId: a,
  role: "SUPER_ADMIN",
  employeeId: null,
};
const query = { page: 1, pageSize: 25 };
const isCode = (code: string) => (error: unknown) =>
  error instanceof ApiError && error.code === code;
const contextFor = (role: AuthContext["role"]) => ({ ...admin, role });

function fakeDatabase() {
  const audits: Record<string, unknown>[] = [];
  const writes: Record<string, unknown>[] = [];
  const companies = [
    { id: a, name: "Alpha" },
    { id: b, name: "Beta" },
  ];
  let existing = {
    id: uid,
    companyId: a,
    employeeId: null as string | null,
    role: "MANAGER",
    employee: null as null | { companyId: string; status: string },
    _count: {
      createdProjects: 0,
      createdTasks: 0,
      createdAssignments: 0,
      createdFileMappings: 0,
    },
  };
  const tx = {
    company: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        companies.find((c) => c.id === where.id) ?? null,
      findMany: async (args: unknown) => {
        writes.push({ companyQuery: args });
        return companies;
      },
      count: async () => companies.length,
      create: async ({ data }: { data: { name: string } }) => {
        const company = { id: b, ...data };
        writes.push({ company });
        return company;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { name: string };
      }) => {
        writes.push({ company: data });
        return { ...where, ...data };
      },
    },
    user: {
      findUnique: async () => existing,
      findMany: async (args: unknown) => {
        writes.push({ userQuery: args });
        return companies.map((c) => ({
          id: c.id,
          email: c.name + "@example.test",
          companyId: c.id,
        }));
      },
      count: async () => 2,
      create: async ({
        data,
        select,
      }: {
        data: Record<string, unknown>;
        select: Record<string, unknown>;
      }) => {
        writes.push({ user: data, select });
        return { id: uid, role: data.role };
      },
      findUniqueOrThrow: async () => ({ id: uid, role: "EMPLOYEE" }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ update: data });
        return { id: uid, ...data };
      },
    },
    employee: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push({ employee: data });
        return { id: b, email: data.email };
      },
      count: async () => 2,
    },
    project: { count: async () => 3 },
    device: { count: async () => 4 },
    integration: {
      findMany: async (args: unknown) => {
        writes.push({ integrationQuery: args });
        return [
          {
            id: a,
            companyId: a,
            provider: "CLICKUP",
            status: "CONNECTED",
            config: { listId: "list_1" },
            lastSyncAt: new Date("2026-09-07T00:00:00Z"),
            lastError: null,
            createdAt: new Date("2026-09-01T00:00:00Z"),
            updatedAt: new Date("2026-09-07T00:00:00Z"),
            company: { id: a, name: "Alpha" },
            encryptedCredentials: "v1:encrypted",
          },
        ];
      },
      count: async () => 1,
      findUnique: async () => ({ id: a, companyId: a, provider: "CLICKUP" }),
      update: async ({ where, data }: any) => {
        writes.push({ integrationUpdate: { where, data } });
        return { ...where, ...data };
      },
      upsert: async ({ where, create, update }: any) => {
        writes.push({ integrationUpsert: { where, create, update } });
        return { id: a, ...create, ...update };
      },
      deleteMany: async (args: any) => {
        writes.push({ integrationDeleteMany: args });
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
      },
      findMany: async (args: unknown) => {
        writes.push({ logQuery: args });
        return [
          {
            id: a,
            metadata: {
              password: "secret",
              note: "Bearer secret",
              configVersion: 2,
            },
          },
        ];
      },
      count: async () => 101,
    },
  };
  const db = {
    ...tx,
    $transaction: async (
      callback: (value: typeof tx) => Promise<unknown>,
      options: unknown,
    ) => {
      writes.push({ transaction: options });
      return callback(tx);
    },
  } as unknown as AdminDatabase;
  return {
    db,
    audits,
    writes,
    existing,
    setExisting: (value: Partial<typeof existing>) => {
      existing = { ...existing, ...value };
    },
  };
}

test("fresh admin resolution rejects unauthenticated, non-admin, demoted, moved and inactive users", async () => {
  await assert.rejects(
    resolveSuperAdmin(null, async () => null),
    isCode("UNAUTHORIZED"),
  );
  for (const role of ["MANAGER", "EMPLOYEE"] as const)
    await assert.rejects(
      resolveSuperAdmin(contextFor(role), async () => {
        throw new Error("must not read");
      }),
      isCode("FORBIDDEN"),
    );
  for (const current of [
    null,
    { ...admin, active: true, role: "MANAGER" as const },
    { ...admin, active: false },
    { ...admin, active: true, companyId: b },
  ])
    await assert.rejects(
      resolveSuperAdmin(admin, async () => current),
      isCode("UNAUTHORIZED"),
    );
  assert.equal(
    (await resolveSuperAdmin(admin, async () => ({ ...admin, active: true })))
      .role,
    "SUPER_ADMIN",
  );
});

test("all admin API operations reject managers and employees before data access", async () => {
  const route = { params: Promise.resolve({ id: a }) };
  for (const role of ["MANAGER", "EMPLOYEE"] as const) {
    for (const mutation of [false, true]) {
      let called = false;
      const handler = adminHandler(
        async () => contextFor(role),
        () => {
          called = true;
          return {};
        },
        { mutation },
      );
      const response = await handler(
        new Request("https://worklens.test/api/admin", {
          method: mutation ? "POST" : "GET",
        }),
        route,
      );
      assert.equal(response.status, 403);
      assert.equal(called, false);
    }
  }
  const handler = adminHandler(
    async () => admin,
    () => ({ companies: [a, b] }),
  );
  const response = await handler(
    new Request("https://worklens.test/api/admin"),
    route,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.companies, [a, b]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const mutation = adminHandler(
    async () => admin,
    () => ({}),
    { mutation: true },
  );
  assert.equal(
    (
      await mutation(
        new Request("https://worklens.test/api/admin", {
          method: "POST",
          headers: { origin: "https://attacker.test" },
        }),
        route,
      )
    ).status,
    403,
  );
});

test("every admin route export uses the fresh admin authorization boundary", () => {
  for (const route of [
    "",
    "companies/",
    "companies/[id]/",
    "users/",
    "users/[id]/",
    "system-logs/",
    "settings/",
    "integrations/",
  ]) {
    const source = readFileSync(`app/api/admin/${route}route.ts`, "utf8");
    const exports = source.match(/export const (GET|POST|PATCH)/g) ?? [];
    assert.ok(exports.length);
    assert.equal(
      source.match(/adminHandler\(\s*requireSuperAdminContext/g)?.length,
      exports.length,
    );
  }
});

test("all explicit admin services reject normal roles independently of routes", async () => {
  const calls = [
    (c: AuthContext) => listAdminCompanies(c, query),
    (c: AuthContext) => getAdminCompany(c, a),
    (c: AuthContext) => saveAdminCompany(c, null, { name: "Company" }),
    (c: AuthContext) => listAdminUsers(c, query),
    (c: AuthContext) => createAdminUser(c, {}),
    (c: AuthContext) => updateAdminUser(c, uid, {}),
    (c: AuthContext) => listAdminLogs(c, query),
    (c: AuthContext) => adminOverview(c),
    (c: AuthContext) => adminSettings(c),
    (c: AuthContext) => adminIntegrations(c),
    (c: AuthContext) => listAdminIntegrations(c, query),
    (c: AuthContext) => adminTestIntegration(c, a, "CLICKUP"),
    (c: AuthContext) => adminConfigureIntegration(c, a, "CLICKUP", {}),
    (c: AuthContext) => adminDisconnectIntegration(c, a, "CLICKUP"),
    (c: AuthContext) => adminSyncIntegration(c, a, "CLICKUP"),
    (c: AuthContext) => updateAdminSettings(c, {}),
  ];
  for (const role of ["MANAGER", "EMPLOYEE"] as const)
    for (const call of calls)
      await assert.rejects(
        async () => call(contextFor(role)),
        isCode("FORBIDDEN"),
      );
});

test("admin company lists span tenants, paginate and search; detail validates IDs", async () => {
  const f = fakeDatabase();
  const result = await listAdminCompanies(
    admin,
    { ...query, q: "Alpha", page: 2 },
    f.db,
  );
  assert.deepEqual(
    result.items.map((c) => c.id),
    [a, b],
  );
  const args = f.writes[0].companyQuery as {
    where: object;
    skip: number;
    take: number;
  };
  assert.deepEqual(args.where, {
    name: { contains: "Alpha", mode: "insensitive" },
  });
  assert.equal(args.skip, 25);
  assert.equal(args.take, 25);
  assert.equal((await getAdminCompany(admin, b, f.db)).id, b);
  await assert.rejects(
    getAdminCompany(admin, "invalid", f.db),
    isCode("VALIDATION_ERROR"),
  );
  await assert.rejects(getAdminCompany(admin, uid, f.db), isCode("NOT_FOUND"));
});

test("company creation and edits audit in the mutation transaction; duplicate names follow schema", async () => {
  const f = fakeDatabase();
  await assert.rejects(
    saveAdminCompany(admin, "", { name: "Valid" }, f.db),
    isCode("VALIDATION_ERROR"),
  );
  await saveAdminCompany(admin, null, { name: " Alpha " }, f.db);
  await saveAdminCompany(admin, a, { name: "Renamed" }, f.db);
  assert.deepEqual(
    f.audits.map((a) => a.action),
    ["COMPANY_CREATED", "COMPANY_UPDATED"],
  );
  assert.equal(f.audits[0].companyId, b);
  assert.equal(f.audits[0].actorUserId, admin.userId);
  for (const raw of [
    { name: " " },
    { name: "a" },
    { name: "a".repeat(161) },
    { name: "Valid", status: "INACTIVE" },
  ])
    assert.equal(companySchema.safeParse(raw).success, false);
  await assert.rejects(
    saveAdminCompany(admin, uid, { name: "Missing" }, f.db),
    isCode("NOT_FOUND"),
  );
});

test("user lists cross companies with combined filters and explicit safe selects", async () => {
  const f = fakeDatabase();
  assert.equal(
    (
      await listAdminUsers(
        admin,
        { ...query, q: "Beta", companyId: b, role: "MANAGER" },
        f.db,
      )
    ).items.length,
    2,
  );
  const args = f.writes[0].userQuery as {
    where: { companyId: string; role: string; OR: object[] };
    select: Record<string, unknown>;
  };
  assert.equal(args.where.companyId, b);
  assert.equal(args.where.role, "MANAGER");
  assert.equal(args.where.OR.length, 3);
  assert.equal(args.select.passwordHash, undefined);
});

const newUser = {
  companyId: b,
  role: "MANAGER",
  email: " Person@Example.test ",
  temporaryPassword: "temporary-test-password",
};
test("login creation hashes password, normalizes email, excludes hashes and audits", async () => {
  const f = fakeDatabase();
  const result = await createAdminUser(admin, newUser, f.db);
  const write = f.writes.find((w) => w.user)!.user as {
    passwordHash: string;
    email: string;
    companyId: string;
  };
  assert.equal(write.email, "person@example.test");
  assert.equal(write.companyId, b);
  assert.ok(
    await bcrypt.compare(newUser.temporaryPassword, write.passwordHash),
  );
  assert.notEqual(write.passwordHash, newUser.temporaryPassword);
  assert.equal("passwordHash" in result, false);
  assert.equal(f.audits[0].action, "USER_CREATED");
  assert.equal(
    JSON.stringify(f.audits).includes(newUser.temporaryPassword),
    false,
  );
});

test("employee account creation reuses linked employee/login logic and audits both", async () => {
  const f = fakeDatabase();
  await createAdminUser(
    admin,
    { ...newUser, role: "EMPLOYEE", firstName: "Jane", lastName: "Doe" },
    f.db,
  );
  const write = f.writes.find((w) => w.employee)!.employee as {
    companyId: string;
    firstName: string;
    user: { create: { companyId: string; role: string; passwordHash: string } };
  };
  assert.equal(write.companyId, b);
  assert.equal(write.user.create.companyId, b);
  assert.equal(write.user.create.role, "EMPLOYEE");
  assert.equal(write.firstName, "Jane");
  assert.ok(
    await bcrypt.compare(
      newUser.temporaryPassword,
      write.user.create.passwordHash,
    ),
  );
  assert.deepEqual(
    f.audits.map((a) => a.action),
    ["EMPLOYEE_CREATED", "USER_CREATED"],
  );
});

test("user validation rejects invalid roles, missing employee names, extra fields and oversized bcrypt inputs", async () => {
  for (const raw of [
    { ...newUser, role: "OWNER" },
    { ...newUser, role: "EMPLOYEE" },
    { ...newUser, companyId: "bad" },
    { ...newUser, temporaryPassword: "short" },
    { ...newUser, temporaryPassword: "ü".repeat(37) },
    { ...newUser, passwordHash: "spoof" },
  ])
    assert.equal(createUserSchema.safeParse(raw).success, false);
  assert.equal(
    updateUserSchema.safeParse({ companyId: b, role: "OWNER" }).success,
    false,
  );
  const f = fakeDatabase();
  await assert.rejects(
    createAdminUser(admin, { ...newUser, companyId: uid }, f.db),
    isCode("NOT_FOUND"),
  );
  assert.equal(f.audits.length, 0);
});

test("role and company changes preserve employee and authored-record ownership", async () => {
  const f = fakeDatabase();
  f.setExisting({
    employeeId: b,
    employee: { companyId: a, status: "ACTIVE" },
  });
  await assert.rejects(
    updateAdminUser(admin, uid, { companyId: b, role: "EMPLOYEE" }, f.db),
    isCode("CONFLICT"),
  );
  await updateAdminUser(admin, uid, { companyId: a, role: "EMPLOYEE" }, f.db);
  assert.equal(f.audits[0].action, "USER_ROLE_CHANGED");
  f.setExisting({ employeeId: null, employee: null });
  await assert.rejects(
    updateAdminUser(admin, uid, { companyId: a, role: "EMPLOYEE" }, f.db),
    isCode("CONFLICT"),
  );
  f.setExisting({
    _count: {
      createdProjects: 1,
      createdTasks: 0,
      createdAssignments: 0,
      createdFileMappings: 0,
    },
  });
  await assert.rejects(
    updateAdminUser(admin, uid, { companyId: b, role: "MANAGER" }, f.db),
    isCode("CONFLICT"),
  );
  f.setExisting({
    _count: {
      createdProjects: 0,
      createdTasks: 0,
      createdAssignments: 0,
      createdFileMappings: 0,
    },
  });
  await updateAdminUser(admin, uid, { companyId: b, role: "MANAGER" }, f.db);
  assert.equal(f.audits.at(-1)?.action, "USER_COMPANY_CHANGED");
  assert.deepEqual(f.writes[0].transaction, { isolationLevel: "Serializable" });
  await assert.rejects(
    updateAdminUser(
      admin,
      admin.userId,
      { companyId: b, role: "EMPLOYEE" },
      f.db,
    ),
    isCode("CONFLICT"),
  );
});

test("audit logs combine filters, use bounded pagination and sanitize historical metadata", async () => {
  const f = fakeDatabase();
  const result = await listAdminLogs(
    admin,
    {
      ...query,
      page: 3,
      companyId: b,
      actor: "actor@example.test",
      action: "USER_CREATED",
      entityType: "User",
      from: "2026-09-01",
      to: "2026-09-02",
    },
    f.db,
  );
  const args = f.writes[0].logQuery as {
    where: {
      companyId: string;
      action: string;
      entityType: string;
      OR: unknown[];
      createdAt: { gte: Date; lt: Date };
    };
    skip: number;
    take: number;
  };
  assert.equal(args.where.companyId, b);
  assert.equal(args.where.action, "USER_CREATED");
  assert.equal(args.where.entityType, "User");
  assert.equal(args.where.OR.length, 2);
  assert.equal(
    args.where.createdAt.gte.toISOString(),
    "2026-09-01T00:00:00.000Z",
  );
  assert.equal(
    args.where.createdAt.lt.toISOString(),
    "2026-09-03T00:00:00.000Z",
  );
  assert.equal(args.skip, 50);
  assert.equal(args.take, 25);
  assert.equal(result.total, 101);
  assert.deepEqual(result.items[0].metadata, { configVersion: 2 });
  assert.deepEqual(
    safeAuditMetadata({
      role: "secret",
      newRole: "MANAGER",
      nested: { password: "secret" },
      note: "secret",
      configVersion: "secret",
      passwordHash: "secret",
      accessToken: "secret",
      enabled: true,
    }),
    { newRole: "MANAGER", enabled: true },
  );
});

test("query validation rejects invalid dates, huge pages, invalid companies and inverted ranges", () => {
  for (const raw of [
    "page=0",
    "page=100001",
    "pageSize=101",
    "pageSize=0",
    "companyId=bad",
    "from=2026-02-30",
    "from=2026-09-03&to=2026-09-01",
    "role=OWNER",
    "unknown=1",
  ])
    assert.throws(
      () => parseAdminQuery(new URLSearchParams(raw)),
      isCode("VALIDATION_ERROR"),
    );
  assert.deepEqual(parseAdminQuery(new URLSearchParams()), query);
});

test("overview uses real counts and settings report functional capabilities", async () => {
  const f = fakeDatabase();
  const result = await adminOverview(admin, f.db);
  assert.equal(result.companies, 2);
  assert.equal(result.projects, 3);
  assert.equal(result.devices, 4);
  const settings = await adminSettings(admin, f.db);
  assert.equal(settings.globalSettingsAvailable, true);
  assert.equal(typeof settings.notificationDueSoonHours, "number");
  assert.equal(typeof settings.defaultIdleThresholdSeconds, "number");
});

test("normal tenant helpers retain scope and admin role does not bypass manager/employee authorization", () => {
  assert.deepEqual(tenantWhere(a, { companyId: b, id: uid }), {
    companyId: a,
    id: uid,
  });
  assert.throws(() => assertRole(admin, ["MANAGER"]), isCode("FORBIDDEN"));
  assert.throws(() => assertRole(admin, ["EMPLOYEE"]), isCode("FORBIDDEN"));
  const source = readFileSync("lib/auth.ts", "utf8");
  assert.match(
    source,
    /id: context.userId,\s*role: "EMPLOYEE",\s*companyId: context.companyId/,
  );
  assert.match(source, /getActiveManagerContext/);
});

test("initial operator bootstrap is create-only, refuses an existing admin and audits without credentials", async () => {
  const { bootstrapSuperAdmin } =
    await import("../../scripts/bootstrap-super-admin-core");
  const f = fakeDatabase();
  await assert.rejects(
    bootstrapSuperAdmin({ ...newUser, role: "SUPER_ADMIN" }, f.db),
    isCode("CONFLICT"),
  );
  assert.equal(f.audits.length, 0);
  f.db.user.count = (async () => 0) as typeof f.db.user.count;
  await bootstrapSuperAdmin({ ...newUser, role: "SUPER_ADMIN" }, f.db);
  assert.equal(f.audits[0].actorUserId, null);
  assert.equal(f.audits[0].action, "USER_CREATED");
  assert.equal(
    JSON.stringify(f.audits).includes(newUser.temporaryPassword),
    false,
  );
});

test("admin integrations: lists cross-company integrations and strips secrets", async () => {
  const f = fakeDatabase();
  const res = await listAdminIntegrations(admin, query, f.db);
  assert.equal(res.items.length, 1);
  const item = res.items[0];
  assert.equal(item.companyId, a);
  assert.equal(item.companyName, "Alpha");
  assert.equal(item.provider, "CLICKUP");
  assert.equal(item.status, "CONNECTED");
  assert.equal(item.isConfigured, true);
  assert.equal((item as any).encryptedCredentials, undefined);
  assert.equal((item as any).apiToken, undefined);
});

test("admin integrations: disconnects integration with proper database call", async () => {
  const f = fakeDatabase();
  f.db.company.findUnique = (async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    name: "Alpha",
  })) as any;

  const disconnected = await adminDisconnectIntegration(admin, a, "CLICKUP", f.db);
  assert.equal(disconnected.success, true);
  assert.ok(f.writes.some((w) => w.integrationDeleteMany));
});

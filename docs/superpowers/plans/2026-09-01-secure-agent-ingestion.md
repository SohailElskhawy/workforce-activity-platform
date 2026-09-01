# Secure Agent Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide manager-registered devices with secure, idempotent heartbeat and activity-ingestion endpoints.

**Architecture:** A manager creates a `Device` for an employee and receives a high-entropy agent token only once. Agent endpoints authenticate a bearer token plus public device ID, derive employee/company identity from that trusted device, then persist validated activity events idempotently. File/project/task relationships are resolved server-side from an existing `FileMapping` only.

**Tech Stack:** Next.js route handlers, TypeScript, Zod 4, Prisma 7/PostgreSQL, Node `crypto`, Node test runner.

**Spec:** `docs/2026-08-31-soda-demo-design.md` sections 7.3, 8, 10, 14, and 16; `docs/plan.md` Task 6.

## Global Constraints

- The task creates API endpoints only; device-management UI is explicitly deferred.
- Device tokens use `crypto.randomBytes(32)` and `HMAC-SHA256` keyed by `AGENT_TOKEN_PEPPER`; raw tokens are never logged or persisted.
- Agent authentication requires `Authorization: Bearer <token>` and `X-Device-ID: <deviceId>`.
- Agent payload schemas are strict and reject company/employee/project/task identity fields.
- Maximum batch size is 100; each event must have `endAt > startAt` and duration at most 21,600 seconds.
- Activity `companyId`, `employeeId`, and database `deviceId` always come from the authenticated device.
- Activity mappings are resolved only via a same-company normalized file mapping; unmapped files retain null project/task values.
- Agent event retries are idempotent on the database unique key `(deviceId, eventId)`.
- Heartbeat stores server time, not agent-provided time.

---

### Task 1: Agent token and strict input contracts

**Files:**
- Create: `web/lib/agent/token.ts`
- Create: `web/lib/agent/token.test.ts`
- Create: `web/lib/agent/schemas.ts`
- Create: `web/lib/agent/schemas.test.ts`
- Modify: `web/.env.example`

**Interfaces:**
- Produces `createAgentToken(): string`, `hashAgentToken(rawToken: string): string`, `registerDeviceSchema`, `heartbeatSchema`, and `activityBatchSchema`.
- `activityBatchSchema` parses `{ activities: AgentActivityInput[] }`, where each event has only `eventId`, timestamps, type, and optional capture metadata.

- [ ] **Step 1: Write failing token and validation tests**

```ts
test("createAgentToken creates independent prefixed secrets", () => {
  const first = createAgentToken();
  const second = createAgentToken();
  assert.match(first, /^worklens_agent_/);
  assert.notEqual(first, second);
});

test("activityBatchSchema rejects identity fields and oversized batches", () => {
  assert.equal(activityBatchSchema.safeParse({ activities: [{ ...validEvent, companyId: "forged" }] }).success, false);
  assert.equal(activityBatchSchema.safeParse({ activities: Array.from({ length: 101 }, () => validEvent) }).success, false);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the module exports are absent**

Run: `npm.cmd test -- lib/agent/token.test.ts lib/agent/schemas.test.ts`

Expected: failure reporting missing `@/lib/agent/token` and `@/lib/agent/schemas` modules.

- [ ] **Step 3: Implement the smallest token and schema layer**

```ts
export function createAgentToken() {
  return `worklens_agent_${randomBytes(32).toString("base64url")}`;
}

export function hashAgentToken(rawToken: string) {
  const pepper = process.env.AGENT_TOKEN_PEPPER;
  if (!pepper) throw new Error("AGENT_TOKEN_PEPPER must be set.");
  return createHmac("sha256", pepper).update(rawToken).digest("hex");
}
```

Use Zod `.strict()` objects, UUID event IDs, the Prisma `ActivityType` enum values, string bounds from `docs/plan.md`, and `activities: z.array(...).min(1).max(100)`.

- [ ] **Step 4: Re-run the focused tests and then the complete web suite**

Run: `npm.cmd test`

Expected: all tests pass.

### Task 2: Device registration and agent authentication

**Files:**
- Create: `web/lib/agent/authenticate.ts`
- Create: `web/lib/agent/authenticate.test.ts`
- Create: `web/lib/services/devices.ts`
- Create: `web/lib/validation/devices.ts`
- Create: `web/app/api/agent/register/route.ts`

**Interfaces:**
- Produces `registerDevice(context, { employeeId, name })`, `authenticateDevice(request)`, and `AuthenticatedDevice` containing the database device ID, trusted employee ID, and trusted company ID.
- `POST /api/agent/register` accepts a manager session and returns `{ deviceId, token }` with status 201.

- [ ] **Step 1: Write failing registration/authentication tests**

```ts
test("registerDevice creates a device for an employee in the manager company", async () => {
  const result = await registerDevice(managerContext, { employeeId: sameCompanyEmployeeId, name: "MEHMET-PC" });
  assert.match(result.deviceId, /^PC-/);
  assert.match(result.token, /^worklens_agent_/);
});

test("authenticateDevice rejects missing, revoked, and mismatched credentials", async () => {
  await assert.rejects(() => authenticateDevice(new Request("http://test/api/agent/heartbeat")), ApiError);
});
```

- [ ] **Step 2: Run the focused tests and confirm the missing-service failure**

Run: `npm.cmd test -- lib/agent/authenticate.test.ts`

Expected: failure caused by absent device service/authentication modules.

- [ ] **Step 3: Implement registration and trusted device lookup**

`registerDevice` must scope its employee query with `tenantWhere(context.companyId, { id: input.employeeId })`, return `NOT_FOUND` for a cross-tenant employee, create a generated `PC-` device ID, and store only `hashAgentToken(token)`.

`authenticateDevice` must parse both required headers, load `Device` with `companyId`, `employeeId`, and `isActive`, compare fixed-length HMAC digests using `timingSafeEqual`, and return `UNAUTHORIZED` for every invalid credential variant without disclosing which part failed.

The registration route must call `assertSameOrigin`, `requireManagerContext`, `parseRequestBody`, and the existing `ok` / `handleRouteError` helpers.

- [ ] **Step 4: Re-run focused and complete tests**

Run: `npm.cmd test`

Expected: all tests pass.

### Task 3: Activity ingestion, mapping, and idempotency

**Files:**
- Create: `web/lib/agent/file-name.ts`
- Create: `web/lib/agent/file-name.test.ts`
- Create: `web/lib/services/activities.ts`
- Create: `web/lib/services/activities.test.ts`
- Create: `web/app/api/agent/activities/batch/route.ts`

**Interfaces:**
- Produces `normalizeFileName(fileName: string): string`, `ingestActivityBatch(device, activities)`, and `POST /api/agent/activities/batch`.
- `ingestActivityBatch` returns `{ accepted: number }`; duplicate event IDs do not create additional rows.

- [ ] **Step 1: Write failing mapping and ingestion tests**

```ts
test("normalizeFileName returns a lower-case basename", () => {
  assert.equal(normalizeFileName("C:\\Projects\\ABC_A_Block.DWG"), "abc_a_block.dwg");
});

test("ingestion derives identity and resolves only configured file mappings", async () => {
  const result = await ingestActivityBatch(authenticatedDevice, [mappedEvent, unmappedEvent]);
  assert.equal(result.accepted, 2);
  // Persisted mapped event has the file mapping project/task; unmapped event has nulls.
});

test("retrying an event ID does not create a second activity", async () => {
  await ingestActivityBatch(authenticatedDevice, [validEvent]);
  await ingestActivityBatch(authenticatedDevice, [validEvent]);
  assert.equal(await activityCountFor(validEvent.eventId), 1);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail before implementation**

Run: `npm.cmd test -- lib/agent/file-name.test.ts lib/services/activities.test.ts`

Expected: failure caused by absent filename and activity-ingestion modules.

- [ ] **Step 3: Implement normalized file resolution and idempotent writes**

`normalizeFileName` trims the supplied value, converts `/` to `\\`, keeps the final path segment, and lowercases it.

For each event, calculate `durationSeconds = Math.floor((endAt.getTime() - startAt.getTime()) / 1000)` and reject values outside `1..21600` with `VALIDATION_ERROR`. Within one Prisma transaction, find the mapping by `{ companyId: device.companyId, normalizedFileName }`, then create the event with only trusted device/company/employee identity plus mapping IDs. Catch Prisma `P2002` for the `(deviceId, eventId)` constraint and treat it as an accepted duplicate; do not overwrite historic mapping results.

The route must authenticate the device before parsing the strict body and return `ok(await ingestActivityBatch(...))`.

- [ ] **Step 4: Re-run focused and complete tests**

Run: `npm.cmd test`

Expected: all tests pass.

### Task 4: Heartbeat endpoint and end-to-end checks

**Files:**
- Create: `web/lib/services/heartbeats.ts`
- Create: `web/lib/services/heartbeats.test.ts`
- Create: `web/app/api/agent/heartbeat/route.ts`

**Interfaces:**
- Produces `recordHeartbeat(device, { agentVersion, timestamp })` and `POST /api/agent/heartbeat`.
- The service returns `{ lastSeenAt: Date }` and records server `new Date()` for `Device.lastSeenAt`.

- [ ] **Step 1: Write a failing heartbeat test**

```ts
test("recordHeartbeat stores server time rather than agent timestamp", async () => {
  const result = await recordHeartbeat(authenticatedDevice, { agentVersion: "0.1.0", timestamp: new Date("2000-01-01T00:00:00Z") });
  assert.ok(result.lastSeenAt.getTime() > new Date("2025-01-01T00:00:00Z").getTime());
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the service is absent**

Run: `npm.cmd test -- lib/services/heartbeats.test.ts`

Expected: failure caused by absent heartbeat module.

- [ ] **Step 3: Implement and expose heartbeat**

Update only the authenticated device row by its database ID, set `agentVersion` from the validated input, and set `lastSeenAt: new Date()`. The route authenticates first, parses `heartbeatSchema`, and uses `ok` / `handleRouteError`.

- [ ] **Step 4: Run final verification and record the production configuration prerequisite**

Run: `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`.

Expected: tests and lint pass. Build needs non-empty `AUTH_SECRET` and `AGENT_TOKEN_PEPPER` in the production environment; do not commit either secret.


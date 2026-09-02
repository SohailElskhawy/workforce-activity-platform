# Task 10: Audit, Security, and UI State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize mutation audit logging, protect the existing tenant/role/agent/time boundaries with a regression suite, and give existing high-value pages consistent loading and empty/error presentation.

**Architecture:** Audit writes remain inside each existing Prisma transaction and pass through one narrow helper. Security tests exercise current production guards, strict schemas, agent authentication, and ingestion behavior without requiring a database. Reusable state components are presentation-only; server pages use Next.js `loading.tsx` for skeletons and existing server rendering for data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, Zod 4, Node `node:test`, Tailwind, shadcn components.

**Spec:** `docs/superpowers/specs/2026-09-02-task-10-audit-security-ux-design.md`

## Global Constraints

- Work in `web/`; this repository has no `apps/web/` directory.
- Preserve existing audit action strings and transactional behavior.
- Do not add time editing/deleting, assignment removal, project archiving, or confirmation dialogs because these actions are not exposed.
- Agent payloads must remain strict and derive company, employee, and device identity only from authenticated device credentials.
- All security errors must remain `ApiError` instances with their existing status/code semantics.
- Verify from `web/` with `pnpm test`, `pnpm lint`, and `pnpm build` before committing.

---

### Task 1: Audit helper and existing mutation integration

**Files:**
- Create: `web/lib/audit/log.ts`
- Test: `web/lib/audit/log.test.ts`
- Modify: `web/lib/services/projects.ts`
- Modify: `web/lib/services/tasks.ts`
- Modify: `web/lib/services/time-entries.ts`
- Modify: `web/lib/services/file-mappings.ts`
- Modify: `web/lib/services/employee-self.ts`

**Interfaces:**
- Consumes: Prisma transaction delegates with `auditLog.create`, `AuthContext`, and existing mutation result IDs.
- Produces: `writeAudit(tx, entry): Promise<void>`, where `entry` contains `companyId`, `actorUserId`, `action`, `entityType`, `entityId`, and optional JSON `metadata`.

- [ ] **Step 1: Write the failing audit helper contract test**

```ts
test("writeAudit persists complete audit entries through the transaction", async () => {
  const entries: unknown[] = [];
  await writeAudit({ auditLog: { create: async ({ data }) => { entries.push(data); return data; } } }, {
    companyId: "company-a", actorUserId: "manager-a", action: "TASK_CREATED",
    entityType: "Task", entityId: "task-a", metadata: { projectId: "project-a" },
  });
  assert.deepEqual(entries, [{ companyId: "company-a", actorUserId: "manager-a", action: "TASK_CREATED", entityType: "Task", entityId: "task-a", metadata: { projectId: "project-a" } }]);
});
```

The production change that must make this test fail is omitting or changing any audit entry field before it reaches Prisma.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test lib/audit/log.test.ts`

Expected: FAIL because `@/lib/audit/log` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export type AuditEntry = {
  companyId: string; actorUserId: string | null; action: string;
  entityType: string; entityId: string; metadata?: Prisma.InputJsonValue;
};

export async function writeAudit(tx: AuditTransaction, entry: AuditEntry) {
  await tx.auditLog.create({ data: entry });
}
```

Use a minimal structural `AuditTransaction` type so the helper accepts Prisma interactive transactions without exposing the full client type.

- [ ] **Step 4: Replace direct audit writes in current mutations**

Import `writeAudit` and replace every `transaction.auditLog.create` call in the five listed service files. Preserve event names and metadata:

```ts
await writeAudit(transaction, {
  companyId: context.companyId, actorUserId: context.userId,
  action: "TASK_ASSIGNED", entityType: "TaskAssignment", entityId: assignment.id,
  metadata: { taskId: task.id, employeeId: employee.id },
});
```

- [ ] **Step 5: Run the focused test and audit call scan**

Run: `pnpm test lib/audit/log.test.ts; rg "transaction\.auditLog\.create" lib/services`

Expected: the test passes and the search returns no direct transaction audit writes.

### Task 2: Security regression suite

**Files:**
- Create: `web/lib/security/security-regressions.test.ts`
- Modify: `web/lib/validation/time-entries.ts`
- Modify: `web/lib/services/tasks.ts` only if the due-date guard needs an exported testable boundary

**Interfaces:**
- Consumes: `assertRole`, `tenantWhere`, `assertEmployeeActivityScope`, agent schemas/authentication, `ingestActivityBatch`, `validateTimeEntryWindow`, `timeRangesOverlap`, and the task due-date guard.
- Produces: one named Node test suite documenting all ten Task 10 security invariants.

- [ ] **Step 1: Write failing strict-manual-time payload tests**

```ts
test("employee manual-time payload rejects a forged employee ID", () => {
  assert.equal(createTimeEntrySchema.safeParse({
    projectId: projectId, startAt: "2026-09-02T08:00:00.000Z",
    endAt: "2026-09-02T09:00:00.000Z", employeeId: otherEmployeeId,
  }).success, false);
});
```

The production change that must make this test fail is accepting unknown employee identity in the manual-time route payload.

- [ ] **Step 2: Run the focused suite and verify RED**

Run: `pnpm test lib/security/security-regressions.test.ts`

Expected: FAIL because the test file is new; after it is created, the forged employee-ID assertion fails because the current time-entry object schema strips unknown keys.

- [ ] **Step 3: Make the manual-time schema strict and add the complete invariant coverage**

Change the schema to `z.object({...}).strict()` and create explicit tests for:

```ts
assert.throws(() => assertEmployeeActivityScope(employeeA, employeeBId), isForbidden);
assert.deepEqual(tenantWhere("company-a", { id: companyBEmployeeId }), { id: companyBEmployeeId, companyId: "company-a" });
assert.throws(() => assertRole(employeeA, ["MANAGER"]), isForbidden);
assert.equal(activityBatchSchema.safeParse({ activities: [{ ...event, companyId: "company-b" }] }).success, false);
await assert.rejects(() => authenticateDevice(revokedRequest, revokedDevice), isUnauthorized);
await ingestActivityBatch(device, [event, event], store); assert.equal(rows.length, 1);
assert.throws(() => assertDueDateNotPast(yesterday), isValidationError);
assert.throws(() => validateTimeEntryWindow(past, future, now), isValidationError);
assert.equal(timeRangesOverlap(existingStart, existingEnd, incomingStart, incomingEnd), true);
```

Use two distinct employee/company fixtures. For manager cross-company read/assignment protections, assert the exact tenant scope that production services pass to their employee/task queries. For employee project/task creation, assert the manager role guard that route handlers use. Keep the agent token authentication and strict-payload assertions against their production modules, and keep duplicate-event coverage against the production ingestion function with its real conflict-safe store behavior.

- [ ] **Step 4: Run the focused security suite and related affected tests**

Run: `pnpm test lib/security/security-regressions.test.ts lib/agent/authenticate.test.ts lib/agent/schemas.test.ts lib/services/activities.test.ts lib/services/time-rules.test.ts`

Expected: PASS with all authorization, payload, duplicate, deadline, and time-window assertions green.

### Task 3: Reusable state components and existing route integration

**Files:**
- Create: `web/components/states/data-error.tsx`
- Create: `web/components/states/empty-state.tsx`
- Create: `web/components/states/page-skeleton.tsx`
- Create: `web/lib/states.test.ts`
- Modify: `web/app/(manager)/loading.tsx`
- Create: `web/app/(employee)/loading.tsx`
- Modify: `web/app/(manager)/projects/page.tsx`
- Modify: `web/app/(manager)/projects/[id]/page.tsx`
- Modify: `web/app/(manager)/tasks/page.tsx`
- Modify: `web/app/(manager)/tasks/[id]/page.tsx`
- Modify: `web/app/(manager)/employees/page.tsx`
- Modify: `web/app/(manager)/employees/[id]/page.tsx`
- Modify: `web/app/(employee)/my-time/page.tsx`
- Modify: `web/app/(employee)/my-dashboard/page.tsx`
- Modify: `web/app/(employee)/my-activity/page.tsx`

**Interfaces:**
- Consumes: existing `Skeleton`, `Button`, route refresh API, and caller-provided copy.
- Produces: `PageSkeleton({ variant?: "dashboard" | "table" | "detail" })`, `EmptyState({ title, description, action? })`, and `DataError({ message?, onRetry? })`.

- [ ] **Step 1: Write the state-component contract tests before implementation**

Use server rendering to assert user-visible copy and semantic controls without adding a browser test framework. Keep the test in `lib/` with a `.test.ts` extension so the existing `pnpm test` glob executes it:

```ts
assert.match(renderToStaticMarkup(createElement(EmptyState, { title: "No projects", description: "Create one to begin." })), /No projects/);
assert.match(renderToStaticMarkup(createElement(DataError, { message: "Could not load data.", onRetry: () => {} })), /Retry/);
assert.match(renderToStaticMarkup(createElement(PageSkeleton, { variant: "table" })), /animate-pulse/);
```

The production changes that must make these tests fail are omitting empty/error copy, hiding retry for a supplied handler, or rendering no skeleton cells.

- [ ] **Step 2: Run state tests and verify RED**

Run: `pnpm test lib/states.test.ts`

Expected: FAIL because the state component modules do not exist.

- [ ] **Step 3: Implement the components and route integration**

Implement a composable `PageSkeleton` using the existing `Skeleton` primitive. Implement `EmptyState` as concise centered copy with optional action content. Implement `DataError` as a client component that renders a retry button only when `onRetry` is supplied; it must call that callback, not own data fetching.

Replace existing inline empty paragraphs in the listed pages with `EmptyState`. Replace the manager loading markup with `PageSkeleton` and add employee-group loading using the same component. Use safe number inputs (`value ?? 0`) at metric boundaries before calling duration formatters. Keep server-route expected errors on their existing `notFound`/error boundary behavior; do not pass a nonfunctional Retry button into server pages.

- [ ] **Step 4: Run state tests and lint**

Run: `pnpm test lib/states.test.ts; pnpm lint`

Expected: all state tests and lint pass.

### Task 4: Full verification and commit

**Files:**
- Verify: all changed files under `web/`

**Interfaces:**
- Consumes: completed audit helper, security suite, state components, and existing routes.
- Produces: a verified Task 10 commit.

- [ ] **Step 1: Inspect requirements and diff**

Run: `git diff --check; git diff -- web`

Confirm all five existing mutation flows use `writeAudit`, the ten invariant categories have tests, the state components exist and are used, and no new destructive action was introduced.

- [ ] **Step 2: Run the complete required commands**

Run from `web/`:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: each command exits 0.

- [ ] **Step 3: Commit the verified web changes**

```bash
git add web
git commit -m "test: harden demo security and failure states"
```

- [ ] **Step 4: Verify the commit**

Run: `git status --short; git log -1 --oneline`

Expected: the Task 10 commit is the current commit and no `web/` changes remain unstaged.

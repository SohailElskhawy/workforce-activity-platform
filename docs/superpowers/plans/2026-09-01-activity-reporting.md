# Activity Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn captured activity into tenant-safe file mappings, employee timelines, application summaries, and neutral manual-versus-activity reports.

**Architecture:** Pure aggregation functions calculate active, idle, application, project, task, and time-difference values without creating a combined “worked time” metric. Server-only Prisma services enforce manager/employee scope; API routes expose only authorized read/mutation paths; shared client components render timelines and periodically refresh visible activity data.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7/PostgreSQL, Zod 4, React 19, Tailwind, Node test runner.

**Spec:** `docs/2026-08-31-soda-demo-design.md` sections 14, 17–19, and 21–22; `docs/plan.md` Task 7.

## Global Constraints

- Keep manual time, application activity, and idle time as separate values; never expose a combined worked-time total.
- All manager queries and mutations use the authenticated company ID; employee self-service derives the employee ID server-side.
- File mappings normalize a basename case-insensitively, validate project/task company relationships, and apply only to new ingestion.
- Device online state means `lastSeenAt` is within 90 seconds of server time.
- Activity polling is five seconds while mounted and retains previously rendered data during refresh.
- Unmapped activity remains visible with null project/task associations and an Unmapped badge.

---

### Task 1: Aggregation and file-mapping domain services

**Files:**
- Create: `web/lib/services/activity-reports.ts`
- Create: `web/lib/services/activity-reports.test.ts`
- Create: `web/lib/services/file-mappings.ts`
- Create: `web/lib/validation/file-mappings.ts`

**Interfaces:**
- Produces `manualActivityDifference(manualMinutes, activeSeconds)`, `getEmployeeDaySummary(context, employeeId, day)`, `getProjectSummary(context, projectId)`, `getTaskSummary(context, taskId)`, and `upsertFileMapping(context, input)`.
- Employee summary returns `{ activeSeconds, idleSeconds, manualMinutes, differenceMinutes, applications, timeline }`.

- [ ] **Step 1: Write failing pure aggregation tests**

```ts
test("manualActivityDifference keeps manual time and activity separate", () => {
  assert.equal(manualActivityDifference(120, 5_400), 30);
});

test("summarizeActivities separates active, idle, and applications", () => {
  const summary = summarizeActivities([autocad60m, idle30m, chrome30m]);
  assert.deepEqual(summary, { activeSeconds: 5_400, idleSeconds: 1_800, applications: [
    { name: "AutoCAD", durationSeconds: 3_600 },
    { name: "Chrome", durationSeconds: 1_800 },
  ]});
});
```

- [ ] **Step 2: Run the new tests and verify the missing-module failure**

Run: `npm.cmd test -- lib/services/activity-reports.test.ts`

- [ ] **Step 3: Implement pure calculations, Prisma read services, and mapping mutation**

`manualActivityDifference` returns `manualMinutes - Math.round(activeSeconds / 60)`. Prisma read services scope every `Activity`, `TimeEntry`, employee, project, and task lookup to `context.companyId`. `upsertFileMapping` calls `normalizeFileName`, rejects a foreign project/task or task/project mismatch, upserts `(companyId, normalizedFileName)`, and writes an audit log in the same transaction.

- [ ] **Step 4: Run all tests**

Run: `npm.cmd test`

### Task 2: Protected activity and reporting routes

**Files:**
- Create: `web/app/api/file-mappings/route.ts`
- Create: `web/app/api/activities/route.ts`
- Create: `web/app/api/reports/employee/route.ts`
- Create: `web/app/api/reports/project/route.ts`
- Create: `web/app/api/reports/task/route.ts`

**Interfaces:**
- Produces manager-only mapping, employee-detail activity, and report routes; employee activity route usage derives employee identity from `requireEmployeeContext`.

- [ ] **Step 1: Write failing route-boundary tests for role and tenant scope**

```ts
test("an employee summary request cannot use another employee ID", async () => {
  await assert.rejects(() => getEmployeeDaySummary(employeeContext, otherEmployeeId, today), ApiError);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail before route/service implementation**

Run: `npm.cmd test -- lib/services/activity-reports.test.ts`

- [ ] **Step 3: Implement route handlers using existing response helpers**

All routes use `ok` and `handleRouteError`; mapping mutations use `assertSameOrigin`, manager context, and strict request parsing. The activities endpoint accepts a manager-selected employee ID only after same-company validation. Reports accept scoped date/project/employee filters and return separately named manual, active, and idle fields.

- [ ] **Step 4: Run all tests**

Run: `npm.cmd test`

### Task 3: Shared activity presentation and manager employee detail

**Files:**
- Create: `web/components/activity/activity-timeline.tsx`
- Create: `web/components/activity/application-breakdown.tsx`
- Create: `web/components/activity/activity-poller.tsx`
- Create: `web/components/file-mappings/map-file-dialog.tsx`
- Create: `web/app/(manager)/employees/[id]/page.tsx`
- Modify: `web/app/(manager)/employees/page.tsx`
- Modify: `web/app/(manager)/activities/page.tsx`

**Interfaces:**
- `ActivityTimeline` renders typed timeline events with application/window/file and mapped/unmapped state.
- `ApplicationBreakdown` renders application duration rows.
- `ActivityPoller` refetches a supplied endpoint every 5 seconds and preserves the last successful payload while refreshing.

- [ ] **Step 1: Write failing component/helper tests for mapping labels and polling lifecycle**

```ts
test("toTimelineLabel identifies an unmapped file", () => {
  assert.equal(toTimelineLabel({ fileName: "Unknown.dwg", project: null }), "Unmapped");
});
```

- [ ] **Step 2: Run focused tests and verify missing component/helper exports**

Run: `npm.cmd test -- components/activity/activity-timeline.test.ts`

- [ ] **Step 3: Build the detail page and shared presentation**

The employee list links each employee to `/employees/:id`. The detail route loads same-company summary data, shows identity/department/status/device state, active/idle/manual/in-progress cards, assigned tasks, application breakdown, timeline, and neutral difference. The activities route provides a company activity view and a mapping dialog for unmapped files. Polling updates timeline content without resetting it to a loading state.

- [ ] **Step 4: Run all tests and a development smoke test**

Run: `npm.cmd test`

### Task 4: Employee activity and reports UI

**Files:**
- Modify: `web/app/(employee)/my-activity/page.tsx`
- Modify: `web/app/(manager)/reports/page.tsx`

**Interfaces:**
- Employee activity uses only `requireEmployeeContext`; it never accepts employee ID from client input.
- Reports page presents Employee Summary, Project Summary, Task Summary, and Manual vs Activity tabs.

- [ ] **Step 1: Write failing format tests for neutral difference copy**

```ts
test("formatActivityDifference does not make a productivity claim", () => {
  assert.equal(formatActivityDifference(30), "30m more manual time than activity time");
});
```

- [ ] **Step 2: Run the focused test and verify it fails before implementation**

Run: `npm.cmd test -- lib/services/activity-reports.test.ts`

- [ ] **Step 3: Replace placeholder pages with protected, data-backed views**

The employee page loads the authenticated employee’s day summary and reuses the shared timeline/breakdown components. The manager reports page uses the four named tabs and displays active, idle, manual, and difference metrics with filters limited to date plus employee/project where relevant.

- [ ] **Step 4: Run final verification**

Run: `npm.cmd test`, `npm.cmd run lint`, and `$env:AUTH_SECRET='verification-only'; $env:AGENT_TOKEN_PEPPER='verification-only'; npm.cmd run build`.

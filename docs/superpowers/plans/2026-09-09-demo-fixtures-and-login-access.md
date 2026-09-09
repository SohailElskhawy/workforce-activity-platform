# Demo Fixtures and One-Click Role Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a disabled-by-default, one-click client demo that seeds rich, real WorkLens records without duplication and provides immediate Super Admin, Manager, and Employee access.

**Architecture:** A server-only demo configuration gate enables a shared Prisma fixture service for both the CLI seed command and two same-origin POST routes. Marked fixture companies and a serializable database transaction make seed/reseed/reset operations safe, while a client login panel calls the existing credentials flow with fixed demo accounts only when demo mode is enabled.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7/PostgreSQL, NextAuth Credentials, Zod, node:test, Tailwind/shadcn-style UI.

**Spec:** docs/superpowers/specs/2026-09-09-demo-fixtures-and-login-design.md

## Global Constraints

- Keep existing Next.js, Prisma, NextAuth, authorization, tenant-isolation, validation, and UI component patterns.
- DEMO_MODE is disabled by default; server routes must independently reject demo actions unless it equals true.
- Only a dedicated demonstration database may enable demo mode; no real external credentials, raw tokens, or live integration calls may be stored.
- Reset may delete only companies whose demoFixtureSet equals worklens-client-demo; ordinary tenants must remain untouched.
- Keep normal email/password login available and preserve all normal role authorization and tenant filters.
- Use existing dependencies; reuse ConfirmationDialog, postJson, i18n, and existing API response/error patterns.
- Dates are relative to execution time and activity names/files are fictional and non-sensitive.

---

## File Structure

| File | Responsibility |
| --- | --- |
| web/prisma/schema.prisma and a migration | Add explicit demo fixture ownership to Company. |
| web/lib/demo/config.ts | Server-only feature gate and serializable demo account metadata. |
| web/lib/demo/fixtures.ts | Pure plan plus deterministic transactional seed/reset service. |
| web/lib/demo/http.ts | Testable shared HTTP boundary for seed/reset routes. |
| web/prisma/seed.ts | Thin CLI wrapper around the fixture service. |
| web/app/api/demo/seed/route.ts and reset/route.ts | Same-origin, demo-gated POST endpoints. |
| web/components/auth/demo-login-panel.tsx | Role buttons and demo data controls. |
| web/app/login/page.tsx and i18n dictionaries | Conditionally mount and translate the panel. |
| web/lib/demo/*.test.ts | Config, plan coverage, HTTP, and optional dedicated-DB smoke tests. |
| README.md, web/README.md, web/.env.example | Dedicated-demo deployment and removal instructions. |

### Task 1: Add explicit fixture ownership and the demo mode contract

**Files:**

- Modify: web/prisma/schema.prisma:55-79
- Create: web/prisma/migrations/<timestamp>_demo_fixture_marker/migration.sql
- Create: web/lib/demo/config.ts
- Create: web/lib/demo/config.test.ts
- Modify: web/.env.example

**Interfaces:**

- Produces DEMO_FIXTURE_SET, DEMO_FIXTURE_VERSION, DEMO_PASSWORD, DEMO_ACCOUNTS, and isDemoModeEnabled(env?: NodeJS.ProcessEnv).
- Produces Company.demoFixtureSet: string | null and Company.demoFixtureVersion: number | null; neither field is added to admin/company mutation validation.

- [ ] **Step 1: Write the failing configuration test**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ACCOUNTS, isDemoModeEnabled } from "./config";

test("demo mode needs the literal true flag and lists three unique roles", () => {
  assert.equal(isDemoModeEnabled({}), false);
  assert.equal(isDemoModeEnabled({ DEMO_MODE: "TRUE" }), false);
  assert.equal(isDemoModeEnabled({ DEMO_MODE: "true" }), true);
  assert.deepEqual(DEMO_ACCOUNTS.map((account) => account.role), [
    "SUPER_ADMIN", "MANAGER", "EMPLOYEE",
  ]);
  assert.equal(new Set(DEMO_ACCOUNTS.map((account) => account.email)).size, 3);
});
~~~

- [ ] **Step 2: Run it to verify the missing-module failure**

Run: npm test -- lib/demo/config.test.ts

Expected: FAIL because config.ts does not exist.

- [ ] **Step 3: Implement the minimal server-only configuration**

~~~ts
import "server-only";
import type { UserRole } from "@/src/generated/prisma/enums";

export const DEMO_FIXTURE_SET = "worklens-client-demo";
export const DEMO_FIXTURE_VERSION = 1;
export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_ACCOUNTS: ReadonlyArray<{
  role: Extract<UserRole, "SUPER_ADMIN" | "MANAGER" | "EMPLOYEE">;
  email: string;
  label: string;
}> = [
  { role: "SUPER_ADMIN", email: "admin@worklens.demo", label: "Super Admin" },
  { role: "MANAGER", email: "manager@worklens.demo", label: "Manager" },
  { role: "EMPLOYEE", email: "employee@worklens.demo", label: "Employee" },
];
export function isDemoModeEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.DEMO_MODE === "true";
}
~~~

Add nullable demoFixtureSet and demoFixtureVersion columns and an index on demoFixtureSet. Generate a migration containing only those columns/index. Add DEMO_MODE=false to .env.example with a comment that it must point to a dedicated demo database.

- [ ] **Step 4: Generate and verify**

Run: npx prisma generate && npx prisma validate && npm test -- lib/demo/config.test.ts

Expected: all commands pass.

- [ ] **Step 5: Commit**

~~~bash
git add prisma/schema.prisma prisma/migrations web/lib/demo/config.ts web/lib/demo/config.test.ts .env.example
git commit -m "feat(demo): add fixture ownership and demo mode gate"
~~~

### Task 2: Build the complete deterministic fixture service

**Files:**

- Create: web/lib/demo/fixtures.ts
- Create: web/lib/demo/fixtures.test.ts
- Modify: web/prisma/seed.ts

**Interfaces:**

- Consumes the Task 1 config contract and Prisma.
- Produces buildDemoFixturePlan(now), demoFixtureCompanyWhere(), seedDemoFixtures(), resetDemoFixtures().
- Produces DemoFixtureResult with action, companies, users, employees, projects, tasks, activities, and anomalies counts.

- [ ] **Step 1: Write coverage and isolation-filter tests**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoFixturePlan, demoFixtureCompanyWhere } from "./fixtures";

test("fixture plan covers every displayed lifecycle and has no duplicate business keys", () => {
  const plan = buildDemoFixturePlan(new Date("2026-09-09T12:00:00Z"));
  assert.equal(plan.companies.length, 2);
  assert.deepEqual(new Set(plan.projects.map((row) => row.status)),
    new Set(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]));
  assert.deepEqual(new Set(plan.tasks.map((row) => row.status)),
    new Set(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"]));
  assert.deepEqual(new Set(plan.anomalies.map((row) => row.status)),
    new Set(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]));
  assert.equal(new Set(plan.users.map((row) => row.email)).size, plan.users.length);
  assert.equal(new Set(plan.projects.map((row) => row.companySlug + ":" + row.code)).size, plan.projects.length);
  assert.ok(plan.activities.some((row) => row.type === "COMPUTER_LOCK"));
  assert.ok(plan.activities.some((row) => row.type === "COMPUTER_UNLOCK"));
  assert.ok(plan.integrations.every((row) => row.encryptedCredentials === null));
});

test("only explicitly owned companies are reset candidates", () => {
  assert.deepEqual(demoFixtureCompanyWhere(), {
    demoFixtureSet: "worklens-client-demo",
  });
});
~~~

- [ ] **Step 2: Run the test and verify it fails**

Run: npm test -- lib/demo/fixtures.test.ts

Expected: FAIL because fixtures.ts does not exist.

- [ ] **Step 3: Define the pure, presentation-rich fixture plan**

Use static business identifiers and generate only dates from now. The plan must contain:

- Main company WorkLens Demo Engineering: two managers, at least eight employees, four departments, management relationships, active/inactive employee variation, and demo Manager/Employee users.
- A second marked company with a Super Admin user and lighter, contrasting data for super-admin filters, company details, metrics, users, and integration states.
- All ProjectStatus, TaskStatus, TaskPriority, ActivityType, AnomalyType, AnomalySeverity, AnomalyStatus, IntegrationProvider, and visible IntegrationStatus variants.
- Planned/active/on-hold/completed/archived projects; overdue, due-soon, future, cancelled, parent/child, assigned and unassigned tasks.
- Manual and imported Clockify time, at least 14 recent weekdays of application/idle/lock/unlock/start/stop activity, active and revoked/offline device states, and activity today for employee@worklens.demo.
- Manual/automatic DWG mappings plus unmapped candidate activity; exclusions/tracking settings; approved leave; safe audit records; integration mappings and fake configuration metadata with encryptedCredentials always null.
- Deterministic anomaly records across every review status. Notifications are supplied by due-soon/overdue tasks because the app computes notifications rather than storing a Notification model.

Do not include real client names, filenames, credentials, or agent tokens. Use fake display-only integration configuration and do not mark it as a live connection that users could successfully call.

- [ ] **Step 4: Persist the plan atomically, with safe reseed/reset behavior**

Use one serializable Prisma transaction. Before checking/deleting, call a static PostgreSQL advisory transaction lock. Seed returns already_seeded only when exactly two marked companies have the current version; reset always replaces marked data. Otherwise, delete by demoFixtureCompanyWhere then create the complete set in foreign-key order. Retry only PostgreSQL serializable P2034 conflicts, at most three times.

~~~ts
export async function resetDemoFixtures(): Promise<DemoFixtureResult> {
  return runFixtureOperation("reset");
}

async function runFixtureOperation(mode: "seed" | "reset") {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(947153912)");
    const existing = await tx.company.findMany({
      where: demoFixtureCompanyWhere(),
      select: { id: true, demoFixtureVersion: true },
    });
    if (mode === "seed" && fixtureSetIsCurrent(existing)) {
      return currentFixtureSummary(tx);
    }
    await tx.company.deleteMany({ where: demoFixtureCompanyWhere() });
    return createFixtureSet(tx, buildDemoFixturePlan(new Date()), mode);
  }, { isolationLevel: "Serializable" });
}
~~~

Create a bcrypt hash once for the fixture users. For devices, hash known demo-only values with hashAgentToken and never return or log the input values. Upsert SystemSettings only inside fixture work, documenting that demo mode must use a dedicated database. Return counts, not secrets or raw errors.

- [ ] **Step 5: Make prisma/seed.ts a thin wrapper**

Replace the current inline fixture implementation with resetDemoFixtures(), summary-only console output, and disconnect in finally. Preserve npm run db:seed and print that it is for a dedicated demo database.

- [ ] **Step 6: Verify pure fixture behavior**

Run: npx prisma validate && npm test -- lib/demo/config.test.ts lib/demo/fixtures.test.ts

Expected: Prisma validates; fixture tests prove status coverage, safe integration values, and unique business keys.

- [ ] **Step 7: Commit**

~~~bash
git add lib/demo/fixtures.ts lib/demo/fixtures.test.ts prisma/seed.ts
git commit -m "feat(demo): add deterministic complete demo fixtures"
~~~

### Task 3: Add the demo-gated HTTP boundary

**Files:**

- Create: web/lib/demo/http.ts
- Create: web/lib/demo/http.test.ts
- Create: web/app/api/demo/seed/route.ts
- Create: web/app/api/demo/reset/route.ts

**Interfaces:**

- Consumes isDemoModeEnabled, seedDemoFixtures, resetDemoFixtures, assertSameOrigin, ok, handleRouteError.
- Produces createDemoPostHandler(enabled, operation).
- Each route exports POST only.

- [ ] **Step 1: Write failing handler tests**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";
import { createDemoPostHandler } from "./http";

const result = {
  action: "seeded" as const, companies: 2, users: 12, employees: 10,
  projects: 7, tasks: 24, activities: 240, anomalies: 12,
};

test("disabled demo handler is unavailable and does not run the operation", async () => {
  let called = false;
  const handler = createDemoPostHandler(() => false, async () => {
    called = true;
    return result;
  });
  const response = await handler(new Request("http://localhost/api/demo/seed", { method: "POST" }));
  assert.equal(response.status, 404);
  assert.equal(called, false);
});

test("enabled handler returns private no-store summary", async () => {
  const handler = createDemoPostHandler(() => true, async () => result);
  const response = await handler(new Request("http://localhost/api/demo/seed", {
    method: "POST", headers: { origin: "http://localhost" },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).data.companies, 2);
});
~~~

- [ ] **Step 2: Run and confirm failure**

Run: npm test -- lib/demo/http.test.ts

Expected: FAIL because http.ts does not exist.

- [ ] **Step 3: Implement the handler and routes**

~~~ts
export function createDemoPostHandler(
  enabled: () => boolean,
  operation: () => Promise<DemoFixtureResult>,
) {
  return async (request: Request) => {
    try {
      if (!enabled()) {
        throw new ApiError("NOT_FOUND", "Demo mode is unavailable.", 404);
      }
      assertSameOrigin(request);
      return ok(await operation());
    } catch (error) {
      return handleRouteError(error);
    }
  };
}
~~~

The routes wire the factory directly to the seed/reset operations. Do not add auth bypasses to existing manager/admin routes.

- [ ] **Step 4: Cover hostile/error inputs**

Add tests for a foreign Origin returning 403 without calling the operation and an ordinary thrown error returning the generic 500 payload. Then run:

Run: npm test -- lib/demo/http.test.ts lib/http/request.test.ts

Expected: all tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add lib/demo/http.ts lib/demo/http.test.ts app/api/demo/seed/route.ts app/api/demo/reset/route.ts
git commit -m "feat(demo): expose gated fixture seed and reset endpoints"
~~~

### Task 4: Add login controls and role-specific one-click sign-in

**Files:**

- Create: web/components/auth/demo-login-panel.tsx
- Create: web/components/auth/demo-login-panel.test.tsx
- Modify: web/app/login/page.tsx
- Modify: web/lib/i18n/types.ts
- Modify: web/lib/i18n/dictionaries/en.ts
- Modify: web/lib/i18n/dictionaries/tr.ts

**Interfaces:**

- Consumes serializable accounts/password supplied by LoginPage, existing signIn/getSession/getRoleHomeRoute, postJson, ConfirmationDialog, toast feedback, and i18n.
- Produces DemoLoginPanel({ accounts, password }); LoginPage renders it only when isDemoModeEnabled() is true.

- [ ] **Step 1: Write the failing static render contract**

~~~tsx
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoLoginPanel } from "./demo-login-panel";

test("demo panel exposes all roles and distinct seed/reset actions", () => {
  const markup = renderToStaticMarkup(createElement(DemoLoginPanel, {
    accounts: [
      { role: "SUPER_ADMIN", email: "admin@worklens.demo", label: "Super Admin" },
      { role: "MANAGER", email: "manager@worklens.demo", label: "Manager" },
      { role: "EMPLOYEE", email: "employee@worklens.demo", label: "Employee" },
    ],
    password: "Demo1234!",
  }));
  assert.match(markup, /Sign in as Super Admin/);
  assert.match(markup, /Sign in as Manager/);
  assert.match(markup, /Sign in as Employee/);
  assert.match(markup, /Seed demo data/);
  assert.match(markup, /Reset demo data/);
});
~~~

- [ ] **Step 2: Run and confirm failure**

Run: npm test -- components/auth/demo-login-panel.test.tsx

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the panel with normal auth routing**

Keep LoginForm unchanged. The panel uses one busyAction state to disable all actions. Role buttons sign in with the account email/password through the existing Credentials provider, resolve the NextAuth session, call getRoleHomeRoute, then replace/refresh the router. Seed posts an empty JSON body to /api/demo/seed. Reset opens ConfirmationDialog and only then posts to /api/demo/reset. Show concise success counts and safe error text through the project toast pattern.

~~~ts
const response = await signIn("credentials", {
  email: account.email,
  password,
  redirect: false,
});
if (!response || response.error) throw new ClientRequestError(t.auth.invalidCredentials);
const session = await getSession();
const destination = getRoleHomeRoute(session?.user.role);
if (!destination) throw new ClientRequestError(t.auth.invalidCredentials);
router.replace(destination);
router.refresh();
~~~

Pass DEMO_ACCOUNTS and DEMO_PASSWORD from the server LoginPage only under the flag. Add typed English/Turkish auth.demo messages: heading, explanation, three sign-in labels, seed/reset labels, confirmation title/description, busy states, success summary, and failure. The reset description must say it restores shared baseline data and invalidates older demo sessions.

- [ ] **Step 4: Verify focused UI and i18n tests**

Run: npm test -- components/auth/demo-login-panel.test.tsx lib/i18n.test.ts lib/ui-foundation.test.ts

Expected: all pass; static/login-page coverage confirms LoginForm remains present and DemoLoginPanel is conditional.

- [ ] **Step 5: Commit**

~~~bash
git add components/auth/demo-login-panel.tsx components/auth/demo-login-panel.test.tsx app/login/page.tsx lib/i18n/types.ts lib/i18n/dictionaries/en.ts lib/i18n/dictionaries/tr.ts
git commit -m "feat(demo): add role login and fixture controls"
~~~

### Task 5: Verify real page services, fixture repeatability, and tenant isolation

**Files:**

- Create: web/lib/demo/fixture-smoke.ts
- Create: web/lib/demo/fixture-smoke.test.ts
- Modify: web/package.json

**Interfaces:**

- Consumes resetDemoFixtures/seedDemoFixtures, demo accounts, Prisma, getManagerDashboardMetrics, getManagerActivityTrend, getEmployeeDashboard, listOwnProjects, listOwnTasks, listAnomalies, listAdminCompanies, listAdminUsers, and adminOverview.
- Produces verifyDemoFixtureQueries() and npm run db:verify-demo.

- [ ] **Step 1: Write a dedicated-database smoke test**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";
import { verifyDemoFixtureQueries } from "./fixture-smoke";

test("fixture populates real manager employee and admin page queries", {
  skip: !process.env.DEMO_TEST_DATABASE_URL,
}, async () => {
  const result = await verifyDemoFixtureQueries();
  assert.ok(result.manager.metricCount > 0);
  assert.ok(result.manager.activityTrendPoints >= 7);
  assert.ok(result.employee.projects > 0);
  assert.ok(result.employee.tasks > 0);
  assert.ok(result.admin.companies >= 2);
  assert.ok(result.admin.users >= 3);
  assert.ok(result.admin.anomalies > 0);
  assert.equal(result.unmarkedCompanySurvived, true);
  assert.equal(result.seedWasIdempotent, true);
});
~~~

- [ ] **Step 2: Run and establish the missing-module failure**

Run: npm test -- lib/demo/fixture-smoke.test.ts

Expected: FAIL initially; after implementation it skips without DEMO_TEST_DATABASE_URL and passes only against an explicitly configured dedicated database.

- [ ] **Step 3: Implement the verifier**

The verifier must reset fixtures, resolve the three persisted users, build server-owned AuthContext values, and invoke real page services without stubbing their tenant filters. Create an unmarked company before a reset and prove it survives. Call seedDemoFixtures after reset and assert action is already_seeded plus unchanged company/user/activity/mapping counts; call reset again and assert exactly two marked companies and unique keys. It must print only count/status summaries, require DEMO_MODE=true plus DEMO_TEST_DATABASE_URL for mutation, and disconnect its dedicated Prisma client in finally.

Add this script:

~~~json
"db:verify-demo": "tsx lib/demo/fixture-smoke.ts"
~~~

- [ ] **Step 4: Run targeted verification**

Run: npm test -- lib/demo/fixtures.test.ts lib/demo/fixture-smoke.test.ts

Expected: pure tests pass; smoke test safely skips without a dedicated test database.

- [ ] **Step 5: Commit**

~~~bash
git add lib/demo/fixture-smoke.ts lib/demo/fixture-smoke.test.ts package.json
git commit -m "test(demo): verify fixture coverage and isolation"
~~~

### Task 6: Document, verify end-to-end, and hand off the demo build

**Files:**

- Modify: README.md:84-103
- Modify: web/README.md

**Interfaces:**

- Documents DEMO_MODE=true, dedicated database setup, demo accounts, db:seed/db:verify-demo, reset implications, and removal by disabling the flag.

- [ ] **Step 1: Document client-demo setup and removal**

Replace the current optional-demo-seed sentence with clear setup: use a dedicated database; set DEMO_MODE=true; migrate; run npm run db:seed; use the three role buttons. State reset affects only marked fixtures but invalidates existing demo sessions. State that setting DEMO_MODE=false and redeploying removes the temporary panel and endpoints. Do not document an agent token.

- [ ] **Step 2: Run database verification only after confirming the target is the demo database**

Run: npx prisma migrate deploy && npm run db:seed && npm run db:verify-demo

Expected: migration and seed complete; verification reports populated manager, employee, admin, anomaly, and isolation results. Stop if DATABASE_URL is not explicitly the designated demo database.

- [ ] **Step 3: Run complete automated verification**

Run: npm test && npm run lint && npx tsc --noEmit && npm run build

Expected: every command exits 0; diagnose failures rather than weakening tests.

- [ ] **Step 4: Browser presentation smoke pass**

1. Confirm login has normal credentials plus the panel; use Seed and inspect count feedback.
2. Use Super Admin and inspect companies, company detail, users, logs, integrations, and settings.
3. Use Manager and visit dashboard, people/departments/devices, project/task details, activities, time, reports, intelligence, anomalies, integrations, and tracking settings. Exercise one filter in each table family.
4. Use Employee and visit dashboard, projects, tasks, manual time, and activity; verify current and historical data.
5. Reset at login, sign in again, verify no duplicate records, and confirm an independently created unmarked company remains.
6. Set DEMO_MODE=false, restart, and confirm the panel is hidden and demo endpoints return 404.

- [ ] **Step 5: Commit docs and report the verified result**

~~~bash
git add README.md web/README.md
git commit -m "docs: document isolated client demo mode"
git status --short
~~~

Report test commands and their result, seeded coverage/counts, exact demo controls/accounts, and any pre-existing worktree changes separately.

## Plan Self-Review

- **Spec coverage:** Tasks 1-2 implement the default-off gate, explicit ownership, complete varied fixture data, transaction/lock/retry behavior, and no secrets. Task 3 keeps the temporary public controls server-gated and same-origin. Task 4 supplies normal role routing and optional UI. Task 5 verifies real manager/employee/admin queries, idempotency, and reset isolation. Task 6 covers setup, removal, automated checks, and three-role browser review.
- **Placeholder scan:** No requirement is deferred; the migration timestamp is deliberately generated at implementation time.
- **Type consistency:** DEMO_ACCOUNTS, isDemoModeEnabled, buildDemoFixturePlan, demoFixtureCompanyWhere, seedDemoFixtures, resetDemoFixtures, DemoFixtureResult, and createDemoPostHandler keep the same names throughout the plan.

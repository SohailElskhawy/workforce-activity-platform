# WorkLens Light Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace WorkLens's dark/slate-forward presentation with a readable Inter-based, light blue B2B SaaS design system and apply it consistently to manager, employee, and super-admin experiences without changing product behavior.

**Architecture:** Define visual tokens and Inter loading once at the root, then make existing shared primitives and the role-aware AppShell consume them. Migrate the dashboard and any remaining page-local dark/legacy styling onto those primitives; a small, tenant-scoped server-side read model supplies the seven-day dashboard chart rather than inventing client data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/Base UI, Lucide, Recharts, node:test, Prisma.

**Spec:** `docs/superpowers/specs/2026-09-09-worklens-light-design-system-design.md`

## Global Constraints

- Use Inter as the sole UI font, loaded by Next.js and exposed through `--font-worklens-sans`.
- Use a pale cool-gray canvas, white surfaces, accessible blue primary actions, and semantic green/amber/red only for state.
- Do not add a UI-library dependency.
- Preserve manager, employee, and super-admin navigation boundaries, authorization, tenant isolation, validation, audit logging, and API contracts.
- Keep manual time and automated activity semantically distinct.
- Preserve visible labels, keyboard focus, error/empty/loading states, destructive confirmations, and Turkish/English layout resilience.
- Do not add e-commerce language, upgrade prompts, a generic AI chat widget, or invented productivity facts.

---

## File structure and responsibility map

| File | Responsibility |
| --- | --- |
| `web/app/layout.tsx` | Load Inter once and attach its CSS variable to `<html>`. |
| `web/app/globals.css` | Light color, chart, radius, sidebar, and typography tokens; no default dark theme. |
| `web/components/ui/{button,card,input,badge,kpi-card,data-table,filter-bar}.tsx` | Shared, token-driven light controls and data surfaces. |
| `web/components/states/{empty-state,page-skeleton,data-error}.tsx` | Matching accessible asynchronous states. |
| `web/components/layout/{app-shell,page-header}.tsx` | Light role-aware navigation shell and standard responsive page header. |
| `web/lib/services/dashboard.ts` | Tenant-scoped seven-day application-activity trend read model. |
| `web/app/(manager)/dashboard/page.tsx` | Fetch and pass the dashboard trend with existing server-side data. |
| `web/components/manager/manager-dashboard.tsx` | Reference-inspired operational bento dashboard using only supplied data. |
| `web/app/login/page.tsx`, employee pages, manager pages, admin UI | Remove remaining page-local dark/slate treatment and use the shared system. |
| `web/lib/{ui-foundation,app-shell,manager-dashboard}.test.ts`, `web/lib/services/dashboard.test.ts` | Static rendering, visual contract, and tenant-isolation regression coverage. |

### Task 1: Install the light visual foundation and Inter

**Files:**
- Modify: `web/app/layout.tsx`
- Modify: `web/app/globals.css`
- Create: `web/lib/design-system.test.ts`

**Interfaces:**
- Consumes: Next's `Inter` font export from `next/font/google`.
- Produces: `--font-worklens-sans` resolves to Inter; all existing Tailwind semantic tokens (`background`, `primary`, `sidebar`, `chart-*`) resolve to the light design system.

- [ ] **Step 1: Write the failing visual-foundation source contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("root layout loads Inter and the global theme is light blue", () => {
  const layout = source("app/layout.tsx");
  const css = source("app/globals.css");

  assert.match(layout, /import \{ Inter \} from "next\/font\/google"/);
  assert.match(layout, /const inter = Inter\(\{[^}]*variable: "--font-worklens-sans"/s);
  assert.match(layout, /className=\{`\$\{inter\.variable\} h-full antialiased`\}/);
  assert.match(css, /--background: oklch\(0\.98/);
  assert.match(css, /--primary: oklch\(0\.546 0\.215 262/);
  assert.match(css, /--sidebar: oklch\(1 0 0\)/);
  assert.doesNotMatch(css, /\.dark \{/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="root layout loads Inter" lib/design-system.test.ts`

Expected: FAIL because Inter is not loaded and the current default tokens are black/slate-oriented.

- [ ] **Step 3: Implement the root font and token contract**

In `app/layout.tsx`, load the font without a network runtime dependency and put its variable on `<html>`:

```ts
import { Inter } from "next/font/google";

const inter = Inter({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-worklens-sans",
});

<html lang={locale} className={`${inter.variable} h-full antialiased`}>
```

In `globals.css`, retain the existing semantic variable names but set a light
palette. Use `--background: oklch(0.98 0.005 255)`, a white `--card` and
`--sidebar`, `--foreground: oklch(0.22 0.02 255)`,
`--primary: oklch(0.546 0.215 262)`, `--primary-foreground: oklch(1 0 0)`,
and blue chart tokens. Keep `--destructive` red and give `--ring` a blue value.
Remove the `.dark` token block so an accidental `dark` class cannot restore the
old black experience. Retain the existing Tailwind `@theme inline` semantic
mapping and set `--radius: 0.75rem`.

- [ ] **Step 4: Run the focused test and type/build guard**

Run: `npm test -- --test-name-pattern="root layout loads Inter" lib/design-system.test.ts && npm run build`

Expected: PASS; the production build completes with Inter configured.

- [ ] **Step 5: Commit the foundation**

```bash
git add app/layout.tsx app/globals.css lib/design-system.test.ts
git commit -m "feat(ui): establish light Inter design tokens"
```

### Task 2: Make reusable controls and states match the design system

**Files:**
- Modify: `web/components/ui/button.tsx`
- Modify: `web/components/ui/card.tsx`
- Modify: `web/components/ui/input.tsx`
- Modify: `web/components/ui/badge.tsx`
- Modify: `web/components/ui/kpi-card.tsx`
- Modify: `web/components/ui/data-table.tsx`
- Modify: `web/components/ui/filter-bar.tsx`
- Modify: `web/components/states/empty-state.tsx`
- Modify: `web/components/states/page-skeleton.tsx`
- Modify: `web/components/states/data-error.tsx`
- Modify: `web/lib/ui-foundation.test.ts`

**Interfaces:**
- Consumes: semantic CSS tokens from Task 1.
- Produces: the same exported React component names and props, plus `KpiTone` support for `"blue"`; existing `"violet"`, `"sky"`, `"emerald"`, `"amber"`, and `"rose"` consumers remain valid.

- [ ] **Step 1: Extend the UI foundation test before changing styles**

Add this test alongside the existing static-render tests:

```ts
test("KpiCard keeps a textual trend and renders the blue system tone", () => {
  const markup = renderWithI18n(
    createElement(KpiCard, {
      label: "Tracked time",
      value: "42h",
      trend: { positive: true, value: "+8.4%" },
      tone: "blue",
    }),
  );

  assert.match(markup, /Tracked time/);
  assert.match(markup, /42h/);
  assert.match(markup, /\+8\.4%/);
  assert.match(markup, /bg-blue-50/);
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm test -- --test-name-pattern="blue system tone" lib/ui-foundation.test.ts`

Expected: FAIL because `"blue"` is not part of `KpiTone`.

- [ ] **Step 3: Restyle primitives without breaking their public props**

Make the following exact visual changes while retaining each component's
exports, variants, and accessibility attributes:

```ts
export type KpiTone =
  | "default"
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "sky"
  | "rose";

const toneStyles: Record<KpiTone, string> = {
  default: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  violet: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  rose: "bg-rose-50 text-rose-700",
};
```

Use white cards with `border-slate-200/80`, `shadow-sm`, and 12px-equivalent
rounding. Default buttons must use `bg-primary` and white text; outlines must
remain white with a visible border; focus rings must use `ring`. Inputs,
filters, table wrappers, pagination, empty states, errors, and skeleton cards
must use the same white-surface and soft-gray-border treatment. Do not remove
`role="search"`, `role="status"`, `role="alert"`, button labels, table
semantics, or `DataTable` loading/error/empty branches.

- [ ] **Step 4: Run focused UI tests and lint**

Run: `npm test -- --test-name-pattern="KpiCard|DataTable|FilterBar|Form helpers" lib/ui-foundation.test.ts && npm run lint`

Expected: PASS; no public component API or accessible static markup regresses.

- [ ] **Step 5: Commit shared primitives**

```bash
git add components/ui components/states lib/ui-foundation.test.ts
git commit -m "feat(ui): restyle shared light interface primitives"
```

### Task 3: Convert the role-aware shell to the light blue navigation model

**Files:**
- Modify: `web/components/layout/app-shell.tsx`
- Modify: `web/components/layout/page-header.tsx`
- Modify: `web/components/layout/language-switcher.tsx`
- Modify: `web/components/notifications/notification-bell.tsx`
- Modify: `web/lib/app-shell.test.ts`
- Modify: `web/lib/admin/ui.test.ts`

**Interfaces:**
- Consumes: Task 1 tokens and the unchanged `AppShell({ children, email, role })` API.
- Produces: identical role-filtered links, now in a light fixed sidebar on desktop and a light mobile navigation panel.

- [ ] **Step 1: Add shell visual and authorization assertions**

Append to `lib/app-shell.test.ts`:

```ts
test("shell uses the light blue selected navigation treatment without broadening employee access", () => {
  const markup = renderToStaticMarkup(
    createElement(AppShell, { email: "employee@worklens.demo", role: "EMPLOYEE" }),
  );

  assert.match(markup, /bg-blue-50/);
  assert.match(markup, /text-blue-700/);
  assert.doesNotMatch(markup, /bg-slate-950/);
  assert.doesNotMatch(markup, /href="\/employees"/);
  assert.doesNotMatch(markup, /href="\/admin"/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="light blue selected navigation" lib/app-shell.test.ts`

Expected: FAIL because the current desktop shell has `bg-slate-950` and
emerald-selected navigation.

- [ ] **Step 3: Implement the light shell with unchanged role rules**

In `AppShell`, replace the dark sidebar (`bg-slate-950`, slate-800 borders,
white text) with a white `w-64` sidebar separated by `border-slate-200`. Use
deep slate for normal links and the following selected link treatment in both
desktop and mobile navigation:

```tsx
active
  ? "flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
  : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950";
```

Make the brand mark blue on a pale-blue surface, make the connected account
panel a light bordered surface, and convert the final dashboard-only dark
signal card into a white card with a blue icon panel. Keep `isItemActive`, all
three navigation group arrays, `aria-current`, account email, logout, and the
mobile interaction intact. Give header icon controls, language switching, and
the notification popover white backgrounds, subtle borders, blue focus rings,
and no `slate-950`/black shadow styling. Keep the notification polling and its
deadline semantics unchanged.

- [ ] **Step 4: Run role navigation tests**

Run: `npm test -- --test-name-pattern="shell|admin shell" lib/app-shell.test.ts lib/admin/ui.test.ts`

Expected: PASS; manager, employee, and super-admin visibility assertions still hold.

- [ ] **Step 5: Commit the shell migration**

```bash
git add components/layout/app-shell.tsx components/layout/page-header.tsx components/layout/language-switcher.tsx components/notifications/notification-bell.tsx lib/app-shell.test.ts lib/admin/ui.test.ts
git commit -m "feat(ui): adopt light blue role-aware app shell"
```

### Task 4: Add a safe seven-day dashboard trend read model

**Files:**
- Modify: `web/lib/services/dashboard.ts`
- Create: `web/lib/services/dashboard.test.ts`
- Modify: `web/app/(manager)/dashboard/page.tsx`

**Interfaces:**
- Consumes: server-only `AuthContext`, `tenantWhere`, `ActivityType.APPLICATION`, and Prisma activity rows.
- Produces: `getManagerActivityTrend(context, now?, db?) => Promise<Array<{ day: string; seconds: number }>>`; the dashboard route passes this array as `activityTrend` without exposing a company ID to the client.

- [ ] **Step 1: Write the tenant-isolation and zero-fill tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getManagerActivityTrend } from "./dashboard";

test("dashboard trend is tenant-scoped and returns seven ordered day buckets", async () => {
  let capturedWhere: unknown;
  const db = {
    activity: {
      async findMany({ where }: { where: unknown }) {
        capturedWhere = where;
        return [
          { startAt: new Date("2026-09-07T09:00:00.000Z"), durationSeconds: 120 },
          { startAt: new Date("2026-09-07T14:00:00.000Z"), durationSeconds: 180 },
        ];
      },
    },
  };

  const trend = await getManagerActivityTrend(
    { userId: "manager-1", companyId: "company-a", role: "MANAGER", employeeId: null },
    new Date("2026-09-09T12:00:00.000Z"),
    db,
  );

  assert.equal(trend.length, 7);
  assert.deepEqual(trend.at(-3), { day: "2026-09-07", seconds: 300 });
  assert.match(JSON.stringify(capturedWhere), /company-a/);
  assert.match(JSON.stringify(capturedWhere), /APPLICATION/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="dashboard trend is tenant-scoped" lib/services/dashboard.test.ts`

Expected: FAIL because `getManagerActivityTrend` does not exist.

- [ ] **Step 3: Implement the server-only aggregation and route wiring**

Add the exported read function in `lib/services/dashboard.ts`; it must query
only application rows under `tenantWhere(context.companyId, { type,
startAt: { gte, lt } })`, select only `startAt` and `durationSeconds`, generate
all seven local-day keys, and return zero-second buckets for days with no data.
Accept a narrow injected `db` argument for the unit test, defaulting to
`prisma`; do not accept a company ID string from callers.

In the manager dashboard page, fetch it with the existing `Promise.all` and
pass `activityTrend={activityTrend}` to `ManagerDashboard`:

```ts
const [metrics, projects, tasks, recentActivities, activityTrend] = await Promise.all([
  getManagerDashboardMetrics(context),
  listProjects(context),
  listTasks(context),
  listRecentCompanyActivity(context),
  getManagerActivityTrend(context),
]);
```

- [ ] **Step 4: Run the service test and all dashboard tests**

Run: `npm test -- lib/services/dashboard.test.ts lib/manager-dashboard.test.ts`

Expected: PASS; only company-scoped application activity reaches the trend.

- [ ] **Step 5: Commit the dashboard read model**

```bash
git add lib/services/dashboard.ts lib/services/dashboard.test.ts 'app/(manager)/dashboard/page.tsx'
git commit -m "feat(dashboard): add tenant-scoped activity trend"
```

### Task 5: Recompose the manager dashboard into the WorkLens bento layout

**Files:**
- Modify: `web/components/manager/manager-dashboard.tsx`
- Modify: `web/lib/manager-dashboard.test.ts`

**Interfaces:**
- Consumes: existing `metrics`, `projects`, `tasks`, `recentActivities`, plus Task 4's `activityTrend: Array<{ day: string; seconds: number }>`.
- Produces: `ManagerDashboard` remains a presentational client component and renders factual workforce KPI, chart, portfolio, priority-work, activity, and signal modules.

- [ ] **Step 1: Extend the dashboard render contract**

Change the test fixture to pass:

```ts
activityTrend: [
  { day: "2026-09-03", seconds: 0 },
  { day: "2026-09-04", seconds: 7_200 },
  { day: "2026-09-05", seconds: 10_800 },
  { day: "2026-09-06", seconds: 3_600 },
  { day: "2026-09-07", seconds: 0 },
  { day: "2026-09-08", seconds: 14_400 },
  { day: "2026-09-09", seconds: 9_000 },
],
```

Then add assertions:

```ts
assert.match(markup, /aria-label="7-day tracked application activity"/);
assert.match(markup, /Tracked application activity/);
assert.match(markup, /Today’s signal/);
assert.doesNotMatch(markup, /bg-slate-950/);
```

- [ ] **Step 2: Run the dashboard test to verify it fails**

Run: `npm test -- --test-name-pattern="manager dashboard explains" lib/manager-dashboard.test.ts`

Expected: FAIL because the new `activityTrend` prop and accessible chart are absent.

- [ ] **Step 3: Implement the bento composition using factual data only**

Add `activityTrend` to the component prop type. Create a primary, white
`Card` with a Recharts `ResponsiveContainer`/`AreaChart` (blue `#2563eb`
series), wrapped in a `<figure aria-label="7-day tracked application activity">`
and a text `figcaption` that identifies it as tracked application time. Use
the supplied trend points only; do not calculate productivity or fabricate
week-over-week percentages.

Keep the four top cards and map them to employees online, tracked active time,
idle time, and open/overdue tasks. Use the existing project list, priority
tasks, and recent activity for the remaining cards. Replace the dark "Today's
signal" module with a white surface and blue connection icon treatment. Use a
desktop `xl:grid-cols-12` grid so the trend can span eight columns and its
secondary operational card four; collapse to one column below `lg`.

- [ ] **Step 4: Run dashboard tests and build**

Run: `npm test -- lib/manager-dashboard.test.ts lib/services/dashboard.test.ts && npm run build`

Expected: PASS; the manager dashboard is server-renderable with a responsive
chart and does not require a client-side data fetch.

- [ ] **Step 5: Commit the dashboard migration**

```bash
git add components/manager/manager-dashboard.tsx lib/manager-dashboard.test.ts
git commit -m "feat(ui): compose manager dashboard bento layout"
```

### Task 6: Migrate employee, manager operational, super-admin, and login surfaces

**Files:**
- Modify: `web/app/login/page.tsx`
- Modify: `web/app/(employee)/my-dashboard/page.tsx`
- Modify: `web/app/(employee)/my-activity/page.tsx`
- Modify: `web/app/(employee)/my-projects/page.tsx`
- Modify: `web/app/(employee)/my-tasks/page.tsx`
- Modify: `web/app/(employee)/my-time/page.tsx`
- Modify: `web/app/(manager)/activities/page.tsx`
- Modify: `web/app/(manager)/anomalies/page.tsx`
- Modify: `web/app/(manager)/departments/page.tsx`
- Modify: `web/app/(manager)/devices/page.tsx`
- Modify: `web/app/(manager)/employees/page.tsx`
- Modify: `web/app/(manager)/integrations/page.tsx`
- Modify: `web/app/(manager)/intelligence/page.tsx`
- Modify: `web/app/(manager)/projects/page.tsx`
- Modify: `web/app/(manager)/reports/page.tsx`
- Modify: `web/app/(manager)/settings/page.tsx`
- Modify: `web/app/(manager)/tasks/page.tsx`
- Modify: `web/app/(manager)/time-entries/page.tsx`
- Modify: `web/components/admin/admin-ui.tsx`
- Modify: `web/app/admin/error.tsx`
- Modify: `web/app/admin/loading.tsx`
- Modify: `web/lib/ui-foundation.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3 shared theme, primitives, AppShell, PageHeader, and existing page data/API contracts.
- Produces: every role uses the same title → relevant summary → filters → content order without new API fields, routes, or permission changes.

- [ ] **Step 1: Add route-level visual composition checks**

Add source checks to `lib/ui-foundation.test.ts` so no role is skipped:

```ts
import { readFileSync } from "node:fs";

test("role entry pages use shared headers and avoid the retired dark surface", () => {
  for (const path of [
    "app/(employee)/my-dashboard/page.tsx",
    "app/(manager)/reports/page.tsx",
    "components/admin/admin-ui.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /bg-slate-950/);
  }
  assert.match(readFileSync("app/(employee)/my-dashboard/page.tsx", "utf8"), /PageHeader/);
  assert.match(readFileSync("app/(manager)/reports/page.tsx", "utf8"), /KpiGrid/);
  assert.match(readFileSync("components/admin/admin-ui.tsx", "utf8"), /PageHeader/);
});
```

- [ ] **Step 2: Run the check to verify it fails where legacy dark classes remain**

Run: `npm test -- --test-name-pattern="role entry pages use shared headers" lib/ui-foundation.test.ts`

Expected: FAIL until the retained dark/white hard-coded treatment is removed
from in-scope entry surfaces.

- [ ] **Step 3: Apply each role's approved composition consistently**

Use `PageHeader`, `KpiGrid`, `FilterBar`, `DataTable`, `Card`, and existing
state components rather than ad-hoc wrappers. Preserve all current server
fetches, client mutation handlers, filters, URL parameters, labels, and error
branches. Remove page-local black/dark classes; use `text-slate-900` for
headings, `text-slate-600`/`text-muted-foreground` for supporting content,
and white/surface cards.

For the employee dashboard, keep separate cards/labels for active tracked
time, idle time, and manual time. For manager reports and operational lists,
retain broad contextual filters and export controls. For super-admin, retain
company/user/system-log segregation and server authorization, but route all
tables/forms through the updated light controls. For login, use the same
pale-gray background, white card, and blue brand mark without changing
authentication/redirect behavior.

- [ ] **Step 4: Run UI, auth, and localization tests**

Run: `npm test -- lib/ui-foundation.test.ts lib/app-shell.test.ts lib/admin/ui.test.ts lib/i18n.test.ts`

Expected: PASS; shared UI remains renderable, role access is unchanged, and
English/Turkish formatting behavior remains intact.

- [ ] **Step 5: Commit role-surface migration**

```bash
git add app/login/page.tsx 'app/(employee)' 'app/(manager)' app/admin components/admin/admin-ui.tsx lib/ui-foundation.test.ts
git commit -m "feat(ui): apply light design system across workspaces"
```

### Task 7: Verify accessibility, responsive behavior, and regression safety

**Files:**
- Modify only if an issue is found in the relevant Task 1-6 file; do not refactor unrelated behavior.
- Test: `web/lib/design-system.test.ts`
- Test: `web/lib/ui-foundation.test.ts`
- Test: `web/lib/app-shell.test.ts`
- Test: `web/lib/manager-dashboard.test.ts`
- Test: `web/lib/services/dashboard.test.ts`

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: verified design migration with no authorization, tenant, build, or visual-state regression.

- [ ] **Step 1: Run the design-specific automated suite**

Run:

```bash
npm test -- lib/design-system.test.ts lib/ui-foundation.test.ts lib/app-shell.test.ts lib/admin/ui.test.ts lib/manager-dashboard.test.ts lib/services/dashboard.test.ts
```

Expected: PASS; theme, component, shell, dashboard, and tenant-scoped trend contracts all hold.

- [ ] **Step 2: Run the full application quality gate**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: PASS; record the exact command output in the implementation handoff.

- [ ] **Step 3: Perform browser acceptance checks at desktop, tablet, and mobile widths**

At 1440px, 1024px, and 375px, check `/dashboard`, `/employees`, `/reports`,
`/my-dashboard`, `/my-activity`, `/admin`, `/admin/system-logs`, and `/login`.
Verify each has readable Inter text, a light canvas, white surfaces, blue
primary controls, visible focus states, no horizontal clipping, and no
default-dark surface. Open manager, employee, and super-admin sessions to
verify the sidebar links remain segregated. Verify zero-data/loading/error
states on a table/report and confirm status badges retain text labels.

- [ ] **Step 4: Fix only identified defects and re-run their focused tests**

For every observed issue, add or extend the closest existing test before the
minimal correction. Re-run that file's test plus `npm run lint`; if a shared
primitive changes, also re-run `lib/ui-foundation.test.ts` and `npm run build`.

- [ ] **Step 5: Commit verification fixes only when needed**

For each discovered defect, create a new narrow plan task naming its exact
source and test file before changing code; that task must follow the same
failing-test, focused-test, and isolated-commit sequence used above. Do not
stage or commit a verification-only change in this task, and make no empty
commit when no defects are found.

## Spec coverage review

- Inter, light palette, semantic colors, no default dark theme: Task 1.
- Reusable cards, buttons, inputs, badges, filter/table/state surfaces: Task 2.
- White, responsive, role-aware sidebar/header/notifications: Task 3.
- Stored-data-only manager trend, bento grid, manual/activity distinction: Tasks 4-5.
- Manager, employee, super-admin, and login migration: Task 6.
- Accessibility, localization, responsive checks, tenant isolation, authorization, full tests: Task 7.

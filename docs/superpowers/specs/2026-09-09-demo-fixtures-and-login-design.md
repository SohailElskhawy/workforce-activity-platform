# WorkLens Demo Fixtures and One-Click Role Access

## Purpose

Make a dedicated WorkLens demonstration deployment immediately navigable and
visually complete for a client review. Every manager, employee, and
super-admin page must load against real, representative database data instead
of browser-only placeholders. The feature is temporary but must be safe to
disable and must never affect a non-demo tenant.

## Scope and constraints

- Keep the existing Next.js, Prisma, NextAuth, authorization, tenant-isolation,
  validation, and UI component patterns.
- Expose demo controls only when a server-side `DEMO_MODE=true` flag is set;
  the default is disabled. The same check protects the API routes, not only
  the client UI.
- The enabled flag is intended only for a dedicated demonstration database.
  It is never enabled in a client production database.
- No live credentials, real external calls, raw agent tokens, or sensitive
  activity content are seeded.
- Demo resets affect only explicitly marked fixture companies and global
  demo-owned system settings; regular tenants and their data are out of
  scope for all destructive operations.
- The client request permits all visitors to the temporary demo login page to
  initialize or reset the shared demo data. This deliberately relaxed access
  is bounded by `DEMO_MODE` and will be removed by disabling the flag and
  deleting the small demo surface.

## Chosen design

Create a shared, typed demo-fixture service. The command-line Prisma seed and
the web demo API both call the same service, so local setup and the client
demo cannot drift. Browser-only mocks are rejected because the review must
exercise real page queries, permissions, filters, charts, detail routes, and
mutations.

### Fixture identity, idempotency, and reset

Add an explicit, non-user-editable demo fixture-set marker to `Company` and
index it. All fixture companies share a stable marker such as
`worklens-client-demo-v1`; ordinary companies leave it null.

The fixture service exposes two operations:

- `seed`: if the marker's fixture set is already complete at the current
  fixture version, return its summary without creating a second copy. If it
  is missing or stale, build one complete fixture set.
- `reset`: delete only companies identified by the fixture marker, relying on
  existing foreign-key cascades, then recreate the full deterministic set.

Both operations run through a database transaction with a database-level
single-flight guard and serializable/retry handling. This prevents concurrent
client clicks, the CLI command, or multiple app instances from producing
duplicates or partial fixture sets. Date values are generated relative to the
current date so dashboard activity remains recent after each reset.

The global `SystemSettings` singleton is set to presentation-safe values only
inside a demo-mode fixture operation. Its change is documented because it is
not tenant-owned; demo mode must therefore target its own database.

### Fixture coverage

The main company, **WorkLens Demo Engineering**, contains rich operational
data for manager and employee routes:

- two managers and at least eight employees across Electrical, Mechanical,
  Civil, and Project Management; include active, inactive, and varied
  reporting/department relationships where pages support them;
- projects spanning planned, active, on-hold, completed, and archived states;
  tasks cover every visible workflow status and priority, include dates in
  the past and future, and contain assignments, hierarchy, comments/notes,
  estimates, and completion timestamps where supported;
- manual, imported, and automated work signals across several recent weeks;
  multiple active/revoked/offline device states and application, idle,
  lock/unlock, start/stop records; activity filenames are non-sensitive;
- mapping candidates and confirmed manual/automatic DWG mappings;
- configuration and excluded apps, integration configurations/mappings with
  clearly simulated statuses and no usable credentials, approved leave,
  notifications, and every anomaly type/severity/status;
- audit entries representing key manager/admin actions with safe structured
  metadata.

A second, lighter marked demo company provides different company/user and
integration states for Super Admin company lists, detail views, integrations,
filters, and cross-company metrics. A dedicated Super Admin demo user is
present, together with the primary manager and employee demo users. The
fixture builder records and returns counts so the UI can report successful
initialization.

This data is designed around page queries rather than merely database models:
manager dashboards/reports/intelligence must show trend, workload, anomaly,
prediction, and classification inputs; employee dashboard, activity, time,
task, and project pages must have current and historical content; and every
admin list/detail screen must contain meaningful data.

### Login and controls

When demo mode is enabled, the login card renders a small, clearly labeled
demo panel:

- **Super Admin**, **Manager**, and **Employee** buttons submit the known
  role-specific demo credentials through the existing NextAuth credentials
  flow and then use existing role-home routing;
- **Seed / refresh demo data** calls the demo seed endpoint and reports
  created/available counts;
- **Reset demo data** uses the existing destructive confirmation dialog,
  executes the reset endpoint, and explains that current sessions may need
  reauthentication.

The normal email/password form remains unchanged and is always available.
When demo mode is disabled, the panel is not rendered and both demo routes
return a safe not-found/disabled response. There are no demo credentials or
control code paths in normal UI behavior.

### API and error behavior

Provide a small demo API surface with POST-only seed and reset operations.
The handler verifies demo mode before touching data, invokes the shared
service, returns typed count/status data, and avoids leaking database errors,
credentials, or tokens. A reset failure leaves the prior complete fixture in
place through transaction rollback; a loading state prevents accidental
double-clicks in the browser.

The data service does not change existing manager, employee, agent, or admin
authorization. It supplies database records that those services already read.
Existing tenant filters remain the enforcement point on all normal routes.

## Implementation boundaries

Expected changes are limited to Prisma schema/migration, the seed entrypoint,
the shared demo service and tests, server-side demo routes/configuration, the
login panel/component/tests, translations, and documentation. No unrelated
feature refactors or external dependencies are needed.

## Verification

- Unit-test fixture planning/identity and repeated seed/reset behavior using
  a test database or repository-standard fixtures; assert no duplicate
  companies, users, entity keys, events, or mappings.
- Test reset scope: an unmarked company and its data survive untouched.
- Test disabled-mode behavior and API method validation; demo routes must not
  operate without the server flag.
- Test role button credential selection and established destination routes.
- Query representative manager, employee, and admin services against the
  fixture and assert non-empty, varied results for each page family.
- Run relevant web tests, lint, type/build checks, and a manual three-role
  smoke pass that includes seeding, reset, login, and key filters/detail
  pages.

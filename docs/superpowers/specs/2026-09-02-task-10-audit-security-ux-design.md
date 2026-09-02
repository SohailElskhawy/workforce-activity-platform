# Task 10: Audit, Security, and UI State Design

## Scope

This work applies to the existing `web/` application. The requested `apps/web/`
directory does not exist in this repository. The scope is deliberately limited
to currently exposed flows: project creation, task creation, task assignment,
employee manual-time creation, file-mapping upsert, agent activity ingestion,
and the existing manager and employee pages. It does not introduce time editing
or deletion, assignment removal, or project archiving, because those actions
are not currently exposed.

## Audit logging

Create a server-only `writeAudit(tx, entry)` helper that accepts a Prisma
transaction and the company, actor, action, entity type, entity ID, and optional
JSON metadata. Each existing mutation continues to write its audit event inside
the same transaction as the mutation, but calls the helper instead of accessing
`transaction.auditLog.create` directly. Existing action names and metadata
remain stable.

## Security regression coverage

Create a node:test regression suite alongside server security code. It will
exercise service authorization and tenant queries with narrow in-memory stores
where the production service already accepts a dependency, and route/schema
boundaries for agent payload validation and device authentication. The suite
will protect the listed employee, manager, agent, duplicate-event, deadline,
future-time, and overlapping-time invariants. Tests will assert observable
authorization errors and persisted activity counts, rather than mock-call
details.

## Page states

Create reusable `PageSkeleton`, `EmptyState`, and client-capable `DataError`
components. Server-rendered routes receive loading skeletons through the
Next.js `loading.tsx` convention and concise empty components in current empty
sections. The error component includes Retry only where a client-side retry is
possible; server-rendered pages keep their normal route-level error behavior.
Metrics use existing safe formatter inputs or explicit zero fallbacks so totals
never show `undefined` or `NaN`.

## Destructive actions

No confirmation dialog is added in this task. The current UI has no exposed
time edit/delete, assignment removal, or project archive action to confirm.
Normal create and status flows remain confirmation-free.

## Verification

Run the focused regression tests during TDD, then from `web/` run `pnpm test`,
`pnpm lint`, and `pnpm build`. Commit the finished `web/` changes using the
requested message after verification succeeds.

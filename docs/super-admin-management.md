# Super Admin management

Implemented as a separate `/admin` workspace with explicit `/api/admin` APIs. This slice does not change the database schema or apply migrations.

## Access and initial setup

Existing `SUPER_ADMIN` accounts can sign in through `/login`. The stored role, company, employee link and employee active status are checked before granting admin access. Manager and employee APIs keep their existing role and tenant boundaries. Employee authorization now also rechecks the stored login role, so changed roles cannot retain access through stale JWTs. Login redirects validate the current account to avoid stale-session redirect loops.

For a database without any Super Admin, an operator can create the initial account using the existing company:

1. Provision the company through the existing `db:bootstrap` if necessary.
2. Set `BOOTSTRAP_ADMIN_COMPANY_ID`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` through the operator's environment/secret manager.
3. From `web`, run `npx tsx scripts/bootstrap-super-admin.ts`.

The script refuses to run if any Super Admin exists. It creates a new account, hashes the password with bcrypt cost 12, and writes `USER_CREATED` with a null actor in a serializable transaction. It never promotes or overwrites an existing login and does not print credentials. It has not been run against the configured database as part of this implementation.

## Available screens

- `/admin`: platform counts, companies/devices active within 24 hours, latest ten audit events.
- `/admin/companies`: paginated company search and creation. New companies open directly in their detail page.
- `/admin/companies/[id]`: company name editing, timestamps, user/employee/project/device counts, link to filtered users, tracking configuration and excluded-application count.
- `/admin/users`: cross-company email/employee-name/company-name search, company and role filters, login creation, role/company changes.
- `/admin/system-logs`: paginated platform audit history with UTC date range, company, actor email/ID, exact action and entity-type filters.
- `/admin/settings`: read-only inspection of actual authentication/session configuration and explanation of company-owned tracking settings.
- `/admin/integrations`: truthful empty capability surface. No Integration model or provider connections currently exist; ClickUp, Kolay İK and Clockify synchronization remains for its dedicated tasks.

All screens use EN/TR translations, the shared shell, headers/breadcrumbs, tables, filters, dialogs and feedback/loading/error states.

## Mutation rules

Company names use the existing schema: 2–160 trimmed characters. Names are not unique in the schema, so duplicate names are allowed and IDs distinguish companies. No deletion, activation or deactivation behavior has been invented.

Employee creation reuses `createEmployeeWithStore` and its validation, hashing and nested login creation. Manager and Super Admin logins do not create unnecessary Employee records. New passwords require at least eight characters and at most 72 UTF-8 bytes, preventing bcrypt truncation. Password hashes are never selected in admin responses.

A linked user's company cannot be changed. Unlinked users with authored projects, tasks, assignments or file mappings cannot move companies either. A user can only become an employee when an active same-company Employee is already linked. Administrators cannot change their own role or company. Role/company changes use serializable transactions; concurrent conflicts are reported for retry. The affected user signs in again after a role/company change.

Company and user mutations write audit events in the same transaction. Audit viewers allow only typed, known operational metadata and UUID company-change references. Unknown/free-form values, nested objects, passwords, tokens and secrets are omitted from responses, including historical records.

## Verification and limitations

The admin tests cover the common API authorization boundary, every route's use of that boundary, fresh stored role checks, service guards, cross-company query construction, bounded filters/pagination, company/user mutations, password hashing, unsafe ownership changes, audit sanitation, initial provisioning and EN/TR shell separation. Existing tenant/employee regression tests remain in place.

No global editable settings, integration records, company lifecycle or user activation flags exist in the current schema; the UI does not imply otherwise. Audit free-form metadata is deliberately omitted, so historical explanatory text may not be visible.

The referenced original `docs/SODA MANAGEMENT.pdf` is absent from this checkout. Implementation followed the supplied task and current release documents, with the task taking precedence over older release exclusions.

Validation results: `npx tsc --noEmit` and `npm run build` pass. `npm test` passes 117 tests; the additional root-level suite (not matched by the existing npm glob) passes 20 tests. Targeted lint for all changed TypeScript files passes. Full `npm run lint` reports 15 existing errors and 19 warnings in unrelated files. A read-only database probe confirmed connectivity and the six required company/user/employee/audit/tracking tables; no live mutations, migrations, initial-account provisioning or authenticated browser smoke tests were performed.

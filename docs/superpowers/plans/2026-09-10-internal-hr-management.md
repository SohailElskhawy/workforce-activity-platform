# Internal HR Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the required Kolay İK dependency with internal, company-scoped position and employee-leave management.

**Architecture:** Add a normalized `Position` record and associate it with employees while retaining the existing string as a compatibility display value. Reuse `EmployeeLeave` for internal records; manager routes scope every query to the authenticated company, while the employee route derives the employee ID from the session.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Zod, React Hook Form, existing shadcn-style UI, Node test runner.

**Spec:** User-approved request, 2026-09-10.

## Global Constraints

- Do not change existing employee-status behavior.
- Do not require Kolay İK credentials or trigger external synchronization.
- Keep manager and employee visibility separate and derive ownership server-side.
- Validate every mutation, write audit records, and preserve company isolation.
- Use a validated free-text leave type and no leave-type settings feature.

---

### Task 1: Position data and employee assignment

**Files:**
- Modify: `web/prisma/schema.prisma`
- Create: `web/prisma/migrations/<timestamp>_internal_hr_positions_and_leaves/migration.sql`
- Create: `web/lib/validation/positions.ts`
- Modify: `web/lib/validation/employees.ts`
- Create: `web/lib/services/positions.ts`
- Modify: `web/lib/services/employees.ts`, `web/lib/services/employee-creation.ts`
- Test: `web/lib/validation/positions.test.ts`, `web/lib/services/positions.test.ts`, existing employee validation/service tests

- [ ] Write failing tests that reject blank/duplicate position names, reject cross-company position assignment, and prevent deletion of an assigned position.
- [ ] Add `Position`, an optional `Employee.positionId`, a company/name unique constraint, and a migration that preserves legacy position labels.
- [ ] Add tenant-scoped position listing, create, and deletion services with `POSITION_CREATED`/`POSITION_DELETED` audits.
- [ ] Change employee create/update validation to accept nullable `positionId`, resolve the position only in the manager's company, and copy its name into the existing display field.
- [ ] Run the targeted validation and service tests.

### Task 2: Internal leave API and authorization

**Files:**
- Create: `web/lib/validation/leaves.ts`
- Create: `web/lib/services/leaves.ts`
- Create: `web/app/api/leaves/route.ts`
- Create: `web/app/api/leaves/[id]/route.ts`
- Create: `web/app/api/my/leaves/route.ts`
- Test: `web/lib/validation/leaves.test.ts`, `web/lib/services/leaves.test.ts`

- [ ] Write failing tests for date ordering, free-text type and note limits, manager-only mutations, cross-company IDs, and employee-only self reads.
- [ ] Implement manager company leave listing and CRUD using the existing `EmployeeLeave` table; validate the employee belongs to the manager's company and write `EMPLOYEE_LEAVE_CREATED`, `EMPLOYEE_LEAVE_UPDATED`, and `EMPLOYEE_LEAVE_DELETED` audits.
- [ ] Implement the employee read service with the employee ID taken from `AuthContext`, never from a request parameter.
- [ ] Add route handlers using existing same-origin, request parsing, error handling, and manager/employee context helpers.
- [ ] Run leave validation and service tests.

### Task 3: Manager and employee leave UI

**Files:**
- Create: `web/app/(manager)/leaves/page.tsx`
- Create: `web/app/(employee)/my-leave/page.tsx`
- Create: `web/components/manager/leaves-management.tsx`
- Create: `web/components/manager/employee-leaves-card.tsx`
- Modify: `web/app/(manager)/employees/[id]/page.tsx`
- Modify: `web/components/layout/app-shell.tsx`
- Test: focused component/service tests where practical

- [ ] Write a failing component test for the required empty and populated leave states.
- [ ] Build the manager table/form using the existing dialog, table, toast, and refresh patterns; include employee, leave type, date range, status, and optional note.
- [ ] Build the employee read-only table using `/api/my/leaves`-equivalent server data and add both Leave pages to the role-appropriate navigation.
- [ ] Add a compact recent-leaves card to the manager employee detail page.
- [ ] Run focused UI tests and typecheck.

### Task 4: Position UI and optional Kolay İK presentation

**Files:**
- Create: `web/components/manager/position-management.tsx`
- Modify: `web/app/(manager)/employees/page.tsx`, `web/app/(manager)/employees/[id]/page.tsx`
- Modify: `web/components/manager/create-employee-dialog.tsx`, `web/components/manager/edit-employee-dialog.tsx`
- Modify: `web/components/manager/integrations-view.tsx`
- Test: focused component/validation tests

- [ ] Write a failing test for position selection payloads and unassigned state.
- [ ] Add a small create/delete position section to employee management and replace free-text employee position inputs with a company-position select.
- [ ] Surface assigned position in employee list/detail data and forms.
- [ ] Make the Kolay İK card state that internal HR management is active and external credentials are optional; hide/disable the Kolay sync action without fabricating a sync result.
- [ ] Run focused tests and typecheck.

### Task 5: Regression verification

**Files:**
- Test: all new tests plus affected employee, integration, and authorization tests

- [ ] Run targeted test files after each red-green cycle.
- [ ] Run the web test suite and TypeScript check in a compatible Node environment.
- [ ] Inspect each new route for manager and employee authorization paths and verify source-only tenant ownership.
- [ ] Record any environment-blocked test separately from product failures.

# Manager Employee Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers create an active employee and linked employee login from the Employees page.

**Architecture:** Add a manager-protected `POST /api/employees` route backed by a transaction that creates `Employee`, hashes the temporary password, creates the linked `User`, and writes an audit entry. The existing Employees server page supplies company departments to a new client dialog, which posts the form and refreshes the table.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, React Hook Form, bcryptjs, Prisma 7, node:test.

**Spec:** `docs/superpowers/specs/2026-09-02-manager-employee-creation-design.md`

## Global Constraints

- Manager-only; do not add a super-admin workflow.
- Create `Employee` and linked `User(role: EMPLOYEE)` in one transaction.
- Hash the manager-provided temporary password; never return or log it.
- Tenant-scope the optional department and reject cross-company IDs.
- Do not add invitations, email delivery, password reset, employee editing, or automatic assignment.

---

### Task 1: Validate and create employee/login atomically

**Files:**
- Create: `web/lib/validation/employees.ts`
- Create: `web/lib/validation/employees.test.ts`
- Modify: `web/lib/services/employees.ts`
- Create: `web/lib/services/employees.test.ts` additions

**Interfaces:**
- Produces `createEmployeeSchema` and `CreateEmployeeInput` with `firstName`, `lastName`, `email`, `departmentId`, `position`, and `temporaryPassword`.
- Produces `createEmployee(context: AuthContext, input: CreateEmployeeInput)` and `listDepartments(context: AuthContext)`.

- [ ] **Step 1: Write failing validation tests**

```ts
test("createEmployeeSchema rejects a temporary password shorter than eight characters", () => {
  assert.equal(createEmployeeSchema.safeParse({
    firstName: "Ada", lastName: "Lovelace", email: "ada@example.test",
    temporaryPassword: "short",
  }).success, false);
});
```

- [ ] **Step 2: Run validation test to verify failure**

Run: `npm test -- lib/validation/employees.test.ts`

Expected: FAIL because the employee validation module does not exist.

- [ ] **Step 3: Implement Zod validation**

```ts
export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  departmentId: z.string().uuid().nullable().optional(),
  position: optionalText(160),
  temporaryPassword: z.string().min(8).max(128),
}).strict();
```

- [ ] **Step 4: Write failing service test**

```ts
test("createEmployee creates an active employee and linked hashed employee login", async () => {
  const { rows, store } = createEmployeeStore();
  await createEmployee(managerContext, validInput, store);
  assert.equal(rows.employee.status, "ACTIVE");
  assert.equal(rows.user.role, "EMPLOYEE");
  assert.notEqual(rows.user.passwordHash, validInput.temporaryPassword);
});
```

- [ ] **Step 5: Implement service and transaction**

Verify the selected department belongs to `context.companyId`; create the employee with `ACTIVE`; bcrypt-hash the temporary password; create the linked user; write `EMPLOYEE_CREATED` audit metadata without password data; map Prisma `P2002` to `CONFLICT` with the specified duplicate-email message.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- lib/validation/employees.test.ts lib/services/employees.test.ts`

Expected: PASS. Commit message: `feat(manager): create employee accounts`.

### Task 2: Expose manager API and Employees-page dialog

**Files:**
- Create: `web/app/api/employees/route.ts`
- Create: `web/components/manager/create-employee-dialog.tsx`
- Modify: `web/app/(manager)/employees/page.tsx`
- Modify: `web/lib/services/employees.ts`

**Interfaces:**
- `POST /api/employees` consumes `createEmployeeSchema` and returns the created employee with HTTP 201.
- `CreateEmployeeDialog({ departments: Array<{ id: string; name: string }> })` posts to the route and refreshes the table.

- [ ] **Step 1: Write a failing route/service boundary test**

```ts
test("createEmployee rejects a department belonging to another company", async () => {
  await assert.rejects(
    () => createEmployee(managerContext, { ...validInput, departmentId: "other-company-department" }, store),
    (error) => error instanceof ApiError && error.status === 404,
  );
});
```

- [ ] **Step 2: Run it to verify failure, then implement the route**

Run: `npm test -- lib/services/employees.test.ts`

Expected: FAIL before tenant department validation exists; PASS after it is implemented. The route must use `assertSameOrigin`, `requireManagerContext`, `parseRequestBody`, and `ok(..., { status: 201 })`.

- [ ] **Step 3: Implement dialog and page integration**

Use the existing project-dialog pattern. The dialog must collect all spec fields, default department to none, mark password as a password input, display API errors, clear its state after a successful submission, and refresh the Employees page. Load departments with `listDepartments(context)` in the server page; add **Add employee** as the page-heading action.

- [ ] **Step 4: Type-check, format, and run tests**

Run: `npx tsc --noEmit && npx prettier --check app/api/employees/route.ts components/manager/create-employee-dialog.tsx app/'(manager)'/employees/page.tsx lib/services/employees.ts lib/validation/employees.ts`

Run: `npm test`

Expected: type-check, formatting, and web tests pass on the Windows checkout.

- [ ] **Step 5: Commit**

Commit message: `feat(manager): add employee creation dialog`.

### Task 3: Verify manager workflow

**Files:**
- Modify: `docs/worklens-agent-test-checklist.md`

- [ ] **Step 1: Manual manager verification**

Sign in as manager; create a unique employee with a temporary password; confirm the new row is `Not enrolled`; sign in with the new employee email/password; register a device from the new row; enroll the agent; confirm the employee changes to `Online` and activity appears only on that employee’s My Activity/detail pages.

- [ ] **Step 2: Record result and commit**

Record date, employee email (without password), and outcome in the checklist. Commit message: `test(manager): record employee creation flow`.

## Plan self-review

- Task 1 implements schema, secure hashing, tenant validation, atomic records, and audit data.
- Task 2 exposes only the manager route and the Employees-page interaction.
- Task 3 covers login, device enrollment, agent status, and employee data scope.

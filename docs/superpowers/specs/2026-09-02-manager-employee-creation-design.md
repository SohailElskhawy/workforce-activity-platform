# Manager Employee Creation Design

## Goal

Let a manager create an active employee and the employee's linked WorkLens login from the Employees page, so the employee can enroll an agent and access employee-scoped pages without database or developer tooling.

## Scope

- Add a manager-only **Add employee** dialog to the Employees page.
- Collect first name, last name, work email, optional department, optional position, and a manager-selected temporary password.
- Create `Employee` and its linked `User` (`role: EMPLOYEE`) in one transaction, scoped to the manager's company.
- Hash the temporary password with the existing bcrypt dependency before persistence.
- Return the new employee’s identity for page refresh; never return, log, or persist the plaintext password beyond the request.
- Reject duplicate company/email and invalid department input with an actionable API error.
- Do not add email invitations, password reset, employee editing, department creation, or super-admin workflows.

## Existing constraints

- `Employee` is company-scoped and has a unique `(companyId, email)` constraint.
- `User.email` is globally unique and employee users must link to exactly one employee.
- Existing authentication accepts only `MANAGER` and `EMPLOYEE` accounts; `SUPER_ADMIN` has no usable product workflow.
- Device registration requires an active employee in the manager's company.

## Architecture

The server exposes `POST /api/employees`, protected by the existing
`requireManagerContext()` and same-origin guard. Its schema validates all
manager-supplied fields, including an eight-character-or-longer temporary
password. The service verifies the optional department belongs to the manager's
company, checks for duplicate email, hashes the password, then creates the
employee and linked user in one Prisma transaction.

The existing Employees server page loads company departments and renders a
client dialog. The dialog posts the validated form to the route and refreshes
the list after success. The manager is responsible for securely delivering the
temporary password; the dialog never re-displays it after submission.

## Error handling

- Unauthenticated/non-manager requests: existing 401/403 handling.
- Duplicate employee or user email: HTTP 409 with `An employee with this email already exists.`
- Department outside the manager's company: HTTP 404.
- Invalid field input: existing schema 400 response.
- Transaction failure: existing safe 500 response; no partial employee/user record remains.

## Testing

- Schema tests cover valid input, weak temporary password, and unexpected fields.
- Service tests use a transactional store double to verify password hashing,
  tenant department validation, and atomic employee/login creation.
- Type-check and formatting checks cover the dialog/page integration.
- Run the web test suite from the Windows checkout, where the installed
  `node_modules` platform matches Node/esbuild.

## Employee manager workflow

1. Manager opens **Employees** and selects **Add employee**.
2. Manager enters employee information and a temporary password.
3. Manager selects **Create employee**.
4. The employee appears in the table as **Not enrolled**.
5. Manager shares the temporary password through an approved channel.
6. Manager creates the agent device directly in that employee’s table row.

## Limitations

- The manager must manage temporary-password delivery manually for the demo.
- There is no password change/reset or email invitation flow.
- Employee creation does not assign projects or tasks automatically.

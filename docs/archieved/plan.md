# WorkLens Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a polished internship demo that proves the complete Manager/Employee → Project → Task → Manual Time / Desktop Activity → Application → AutoCAD/DWG workflow, with a simulator fallback so the presentation cannot depend on Windows or AutoCAD.

**Architecture:** `apps/web` is a single Next.js full-stack application containing the shadcn/ui frontend, Auth.js authentication, route handlers, business services, and Prisma access to PostgreSQL. `apps/agent` is a small Python application with platform-independent segmentation/queue/upload logic, a simulator collector, and a Windows collector; both collectors feed the same SQLite queue and `/api/agent/*` contract.

**Tech Stack:** Node.js 24, pnpm, Next.js 16.3.3 App Router, TypeScript, Tailwind CSS, shadcn/ui, Auth.js, Zod, React Hook Form, Recharts, Prisma 7, PostgreSQL, Vitest; Python 3.12+, pytest, pywin32, psutil, httpx, SQLite.

**Spec:** `docs/superpowers/specs/2026-08-31-soda-demo-design.md`

## Global Constraints

- Solo developer; optimize for a reliable Thursday internship demo rather than complete production breadth.
- Hosted web demo plus clean source/README is required; perfect one-command local setup is not required.
- One company is shown in the UI, but every tenant-owned server query must scope by authenticated `companyId`.
- Manager and Employee flows are both required.
- Manual Time and Activity Time remain separate datasets and must never be added together as “worked time.”
- New task due dates in the past are rejected; existing tasks may become overdue naturally.
- Manual time requires `startAt < endAt`, cannot be future-dated, and obvious same-employee overlaps are rejected.
- Agent authentication is device-token based; raw device tokens are never stored in plaintext.
- The server derives company/employee identity from the authenticated device and never trusts those identifiers from activity payloads.
- Activity batches are idempotent via unique `(deviceId, eventId)`.
- Default idle threshold is 300 seconds; idle time is never counted as active application/project time.
- AutoCAD integration is shallow: detect process/window title, extract `.dwg` where possible, then resolve manual filename mapping.
- No screenshots, keystrokes, passwords, clipboard capture, deep AutoCAD plugin, WebSockets, Redis, microservices, AI, or external HR/task integrations.
- The simulator must use the exact same queue, authentication, uploader, API validation, and database pipeline as the real Windows collector.
- Every high-value UI screen needs loading, success, empty, and error states.
- Do not add new features Wednesday night; Wednesday is for integration, deployment, hardening, README, and rehearsal.

---

# Delivery Order

## Tonight — Foundation and Core Product

Complete Tasks 1–4. The target state before stopping tonight is: database migrated and seeded, manager/employee login works, tenant/RBAC helpers exist, and manager can view/create projects/tasks/assignments from a polished shell.

## Tuesday — Time + Activity Pipeline

Complete Tasks 5–8. The target state Tuesday night is: employee flow works, agent API accepts authenticated/idempotent batches, simulator produces activity into PostgreSQL, DWG mapping resolves, and the manager can see a live-updating employee timeline.

## Wednesday — Windows Agent, Reports, Deployment, Hardening

Complete Tasks 9–12. Do not expand scope. The target state is a deployed, seeded, rehearsed demo with fallback levels proven.

---

## Task 1: Scaffold the WorkLens Repository and UI Foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `apps/web/**` via `create-next-app`
- Create: `apps/web/src/components/app-sidebar.tsx`
- Create: `apps/web/src/components/app-header.tsx`
- Create: `apps/web/src/app/(manager)/layout.tsx`
- Create: `apps/web/src/app/(employee)/layout.tsx`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/lib/env.ts`
- Test: `apps/web/src/lib/env.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: a pnpm workspace; Next.js App Router app; `env` validated configuration; reusable manager/employee shells; shadcn primitives available to later tasks.

- [ ] **Step 1: Rename the repository working directory when execution starts**

Run from the parent directory:

```bash
mv soda-demo worklens
cd worklens
```

Expected: `pwd` ends in `/worklens` and the existing `docs/superpowers/specs/2026-08-31-soda-demo-design.md` remains present.

- [ ] **Step 2: Create the workspace root files**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/web"
```

Create root `package.json`:

```json
{
  "name": "worklens",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm db:generate && pnpm --filter web build",
    "lint": "pnpm --filter web lint",
    "test": "pnpm --filter web test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

Create `.gitignore` containing at least:

```gitignore
node_modules/
.next/
.env
.env.local
.env.*.local
*.db
*.sqlite3
__pycache__/
.pytest_cache/
.venv/
apps/agent/data/
```

- [ ] **Step 3: Scaffold Next.js**

Run:

```bash
pnpm create next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Then set `apps/web/package.json` name to:

```json
"name": "web"
```

Run:

```bash
pnpm install
pnpm --filter web dev
```

Expected: Next.js starts successfully and the root page is reachable on `http://localhost:3000`.

- [ ] **Step 4: Install UI, validation, auth, data, and test dependencies**

Run:

```bash
pnpm --filter web add next@16.3.3 next-auth zod react-hook-form @hookform/resolvers recharts lucide-react bcryptjs date-fns @prisma/client@7 @prisma/adapter-pg pg
pnpm --filter web add -D vitest @vitest/coverage-v8 @types/pg
pnpm add -Dw prisma@7 tsx
cd apps/web
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card badge table dialog alert-dialog form input select textarea tabs dropdown-menu sheet skeleton alert progress separator
cd ../..
```

Expected: package installation succeeds and shadcn components are generated under `apps/web/src/components/ui`.

- [ ] **Step 5: Write the failing environment validation test**

Create `apps/web/src/lib/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("rejects missing required server secrets", () => {
    expect(() => parseEnv({})).toThrow();
  });

  it("accepts a complete configuration", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/worklens",
        AUTH_SECRET: "01234567890123456789012345678901",
        NEXTAUTH_URL: "http://localhost:3000",
        AGENT_TOKEN_PEPPER: "01234567890123456789012345678901"
      })
    ).toMatchObject({ NEXTAUTH_URL: "http://localhost:3000" });
  });
});
```

Add to `apps/web/package.json`:

```json
"test": "vitest run"
```

Run:

```bash
pnpm --filter web test src/lib/env.test.ts
```

Expected: FAIL because `parseEnv` does not exist.

- [ ] **Step 6: Implement validated environment configuration**

Create `apps/web/src/lib/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  AGENT_TOKEN_PEPPER: z.string().min(32)
});

export function parseEnv(input: Record<string, string | undefined>) {
  return envSchema.parse(input);
}

export const env = parseEnv({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  AGENT_TOKEN_PEPPER: process.env.AGENT_TOKEN_PEPPER
});
```

Create `.env.example`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/worklens
AUTH_SECRET=replace-with-at-least-32-random-characters
NEXTAUTH_URL=http://localhost:3000
AGENT_TOKEN_PEPPER=replace-with-at-least-32-random-characters
```

Run:

```bash
pnpm --filter web test src/lib/env.test.ts
```

Expected: PASS.

- [ ] **Step 7: Build the reusable dashboard shell**

Create `apps/web/src/components/app-sidebar.tsx` with two navigation configurations:

```ts
export const managerNav = [
  ["Dashboard", "/dashboard"],
  ["Employees", "/employees"],
  ["Projects", "/projects"],
  ["Tasks", "/tasks"],
  ["Activities", "/activities"],
  ["Reports", "/reports"]
] as const;

export const employeeNav = [
  ["My Dashboard", "/my-dashboard"],
  ["My Tasks", "/my-tasks"],
  ["My Time", "/my-time"],
  ["My Activity", "/my-activity"],
  ["My Projects", "/my-projects"]
] as const;
```

Implement `app-sidebar.tsx`, `app-header.tsx`, and route-group layouts using shadcn `Sheet` for mobile navigation and a fixed desktop sidebar.

- [ ] **Step 8: Verify the scaffold**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: all commands exit with code 0.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: scaffold WorkLens web application"
```

---

## Task 2: Prisma Schema, Database Client, Seed Data, and Core Business Rules

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `prisma/seed.ts`
- Create: `apps/web/src/lib/db.ts`
- Create: `apps/web/src/server/domain/time.ts`
- Create: `apps/web/src/server/domain/files.ts`
- Create: `apps/web/src/server/domain/tasks.ts`
- Test: `apps/web/src/server/domain/time.test.ts`
- Test: `apps/web/src/server/domain/files.test.ts`
- Test: `apps/web/src/server/domain/tasks.test.ts`

**Interfaces:**
- Consumes: `env.DATABASE_URL` from Task 1.
- Produces: `db: PrismaClient`; all approved data models/enums; `calculateDurationMinutes(startAt, endAt)`; `assertManualTimeRange(startAt, endAt, now)`; `normalizeFileName(value)`; `assertDueDateNotPast(dueDate, today)`; seeded demo company/accounts/projects/tasks/activity.

- [ ] **Step 1: Write failing business-rule tests before the database schema**

Create `apps/web/src/server/domain/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertManualTimeRange, calculateDurationMinutes } from "./time";

describe("manual time rules", () => {
  const now = new Date("2026-08-31T20:00:00Z");

  it("calculates duration on the server", () => {
    expect(calculateDurationMinutes(
      new Date("2026-08-31T09:00:00Z"),
      new Date("2026-08-31T12:00:00Z")
    )).toBe(180);
  });

  it("rejects end before start", () => {
    expect(() => assertManualTimeRange(
      new Date("2026-08-31T12:00:00Z"),
      new Date("2026-08-31T09:00:00Z"),
      now
    )).toThrow("End time must be after start time");
  });

  it("rejects future time", () => {
    expect(() => assertManualTimeRange(
      new Date("2026-09-01T09:00:00Z"),
      new Date("2026-09-01T10:00:00Z"),
      now
    )).toThrow("Manual time cannot be in the future");
  });
});
```

Create `apps/web/src/server/domain/files.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeFileName } from "./files";

describe("normalizeFileName", () => {
  it.each([
    ["C:\\Projects\\ABC_A_Block.dwg", "abc_a_block.dwg"],
    ["ABC_A_Block.DWG", "abc_a_block.dwg"],
    [" abc_a_block.dwg ", "abc_a_block.dwg"]
  ])("normalizes %s", (value, expected) => {
    expect(normalizeFileName(value)).toBe(expected);
  });
});
```

Create `apps/web/src/server/domain/tasks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertDueDateNotPast } from "./tasks";

describe("task due-date rules", () => {
  it("rejects a new task deadline in the past", () => {
    expect(() => assertDueDateNotPast(
      new Date("2026-08-30T00:00:00Z"),
      new Date("2026-08-31T00:00:00Z")
    )).toThrow("Deadline cannot be in the past");
  });
});
```

Run:

```bash
pnpm --filter web test src/server/domain
```

Expected: FAIL because the domain functions do not exist.

- [ ] **Step 2: Implement the pure domain functions**

Create `apps/web/src/server/domain/time.ts`:

```ts
export function calculateDurationMinutes(startAt: Date, endAt: Date) {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
}

export function assertManualTimeRange(startAt: Date, endAt: Date, now = new Date()) {
  if (endAt <= startAt) throw new Error("End time must be after start time");
  if (startAt > now || endAt > now) throw new Error("Manual time cannot be in the future");
  if (endAt.getTime() - startAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error("Manual time entry cannot exceed 24 hours");
  }
}
```

Create `apps/web/src/server/domain/files.ts`:

```ts
export function normalizeFileName(value: string) {
  const normalizedSeparators = value.trim().replaceAll("\\", "/");
  return normalizedSeparators.split("/").at(-1)!.toLowerCase();
}
```

Create `apps/web/src/server/domain/tasks.ts`:

```ts
export function assertDueDateNotPast(dueDate: Date | null, today = new Date()) {
  if (!dueDate) return;
  const due = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (due < current) throw new Error("Deadline cannot be in the past");
}
```

Run:

```bash
pnpm --filter web test src/server/domain
```

Expected: PASS.

- [ ] **Step 3: Define the Prisma 7 configuration**

Create root `prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") }
});
```

- [ ] **Step 4: Implement the approved Prisma data model**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../apps/web/src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  SUPER_ADMIN
  MANAGER
  EMPLOYEE
}
enum EmployeeStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
enum ProjectStatus {
  PLANNED
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}
enum TaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  REVIEW
  COMPLETED
  CANCELLED
}
enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
enum ActivityType {
  APPLICATION
  IDLE
  COMPUTER_LOCK
  COMPUTER_UNLOCK
  SYSTEM_START
  SYSTEM_STOP
}
enum DeviceStatus {
  ACTIVE
  REVOKED
}

model Company {
  id              String           @id @default(cuid())
  name            String
  users           User[]
  employees       Employee[]
  departments     Department[]
  projects        Project[]
  tasks           Task[]
  taskAssignments TaskAssignment[]
  timeEntries     TimeEntry[]
  devices         Device[]
  activities      Activity[]
  fileMappings    FileMapping[]
  auditLogs       AuditLog[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

model User {
  id               String           @id @default(cuid())
  companyId        String
  email            String           @unique
  passwordHash     String
  role             UserRole
  employeeId       String?          @unique
  company          Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employee         Employee?        @relation(fields: [employeeId], references: [id], onDelete: SetNull)
  createdProjects  Project[]        @relation("ProjectCreator")
  createdTasks     Task[]           @relation("TaskCreator")
  assignmentsMade  TaskAssignment[] @relation("AssignmentCreator")
  fileMappingsMade FileMapping[]    @relation("FileMappingCreator")
  auditLogs        AuditLog[]       @relation("AuditActor")
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([companyId])
}

model Employee {
  id                 String           @id @default(cuid())
  companyId          String
  firstName          String
  lastName           String
  email              String
  phone              String?
  departmentId       String?
  position           String?
  managerId          String?
  status             EmployeeStatus   @default(ACTIVE)
  hireDate           DateTime?
  company            Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  department         Department?      @relation("EmployeeDepartment", fields: [departmentId], references: [id], onDelete: SetNull)
  manager            Employee?        @relation("EmployeeManager", fields: [managerId], references: [id], onDelete: SetNull)
  directReports      Employee[]       @relation("EmployeeManager")
  managedDepartments Department[]     @relation("DepartmentManager")
  user               User?
  assignments        TaskAssignment[]
  timeEntries        TimeEntry[]
  devices            Device[]
  activities         Activity[]
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@unique([companyId, email])
  @@index([companyId, status])
}

model Department {
  id        String     @id @default(cuid())
  companyId String
  name      String
  managerId String?
  company   Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  manager   Employee?  @relation("DepartmentManager", fields: [managerId], references: [id], onDelete: SetNull)
  employees Employee[] @relation("EmployeeDepartment")
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
}

model Project {
  id             String        @id @default(cuid())
  companyId      String
  name           String
  code           String
  description    String?
  clientName     String?
  status         ProjectStatus @default(PLANNED)
  startDate      DateTime?
  endDate        DateTime?
  estimatedHours Int?
  createdById    String
  company        Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy      User          @relation("ProjectCreator", fields: [createdById], references: [id], onDelete: Restrict)
  tasks          Task[]
  timeEntries    TimeEntry[]
  activities     Activity[]
  fileMappings   FileMapping[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([companyId, code])
  @@index([companyId, status])
}

model Task {
  id               String           @id @default(cuid())
  companyId        String
  projectId        String
  parentTaskId     String?
  title            String
  description      String?
  createdById      String
  status           TaskStatus       @default(TODO)
  priority         TaskPriority     @default(MEDIUM)
  estimatedMinutes Int?
  dueDate          DateTime?
  completedAt      DateTime?
  company          Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  project          Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parentTask       Task?            @relation("TaskHierarchy", fields: [parentTaskId], references: [id], onDelete: SetNull)
  subtasks         Task[]           @relation("TaskHierarchy")
  createdBy        User             @relation("TaskCreator", fields: [createdById], references: [id], onDelete: Restrict)
  assignments      TaskAssignment[]
  timeEntries      TimeEntry[]
  activities       Activity[]
  fileMappings     FileMapping[]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([companyId, status])
  @@index([projectId, status])
  @@index([dueDate])
}

model TaskAssignment {
  id           String   @id @default(cuid())
  companyId    String
  taskId       String
  employeeId   String
  assignedById String
  assignedAt   DateTime @default(now())
  company      Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  task         Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  employee     Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  assignedBy   User     @relation("AssignmentCreator", fields: [assignedById], references: [id], onDelete: Restrict)

  @@unique([taskId, employeeId])
  @@index([companyId])
  @@index([employeeId])
}

model TimeEntry {
  id              String    @id @default(cuid())
  companyId       String
  employeeId      String
  projectId       String
  taskId          String?
  startAt         DateTime
  endAt           DateTime
  durationMinutes Int
  notes           String?
  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employee        Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  task            Task?     @relation(fields: [taskId], references: [id], onDelete: SetNull)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([companyId, startAt])
  @@index([employeeId, startAt])
  @@index([projectId, startAt])
}

model Device {
  id             String       @id @default(cuid())
  companyId      String
  employeeId     String
  deviceId       String       @unique
  name           String
  agentTokenHash String
  agentVersion   String?
  lastSeenAt     DateTime?
  status         DeviceStatus @default(ACTIVE)
  company        Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employee       Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  activities     Activity[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([companyId])
  @@index([employeeId])
}

model Activity {
  id              String       @id @default(cuid())
  companyId       String
  employeeId      String
  deviceId        String
  eventId         String
  startAt         DateTime
  endAt           DateTime
  durationSeconds Int
  applicationName String?
  processName     String?
  windowTitle     String?
  fileName        String?
  projectId       String?
  taskId          String?
  type            ActivityType
  company         Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employee        Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  device          Device       @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  project         Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)
  task            Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)
  createdAt       DateTime     @default(now())

  @@unique([deviceId, eventId])
  @@index([companyId, startAt])
  @@index([employeeId, startAt])
  @@index([projectId, startAt])
  @@index([taskId, startAt])
}

model FileMapping {
  id                 String   @id @default(cuid())
  companyId          String
  normalizedFileName String
  displayFileName    String
  projectId          String
  taskId             String?
  createdById        String
  company            Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  project            Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  task               Task?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
  createdBy          User     @relation("FileMappingCreator", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([companyId, normalizedFileName])
  @@index([companyId])
}

model AuditLog {
  id          String   @id @default(cuid())
  companyId   String
  actorUserId String
  action      String
  entityType  String
  entityId    String
  metadataJson Json
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  actor       User     @relation("AuditActor", fields: [actorUserId], references: [id], onDelete: Restrict)
  createdAt   DateTime @default(now())

  @@index([companyId, createdAt])
  @@index([entityType, entityId])
}
```

This schema keeps redundant `companyId` columns intentionally so every tenant-owned query can enforce tenant isolation directly. Service-layer validation must ensure redundant foreign keys agree (for example `Task.companyId === Project.companyId`).

- [ ] **Step 5: Create the Prisma client singleton**

Create `apps/web/src/lib/db.ts` using Prisma 7’s PostgreSQL adapter:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

Configure the Prisma client generator output to `../apps/web/src/generated/prisma`.

- [ ] **Step 6: Generate and migrate**

Run against the development PostgreSQL URL:

```bash
pnpm db:generate
pnpm db:migrate --name init
```

Expected: Prisma client generation succeeds and all 12 core tables exist.

- [ ] **Step 7: Create deterministic demo seed data**

Create `prisma/seed.ts` that deletes demo-owned data in foreign-key-safe order, then creates:

```text
1 company: WorkLens Demo Engineering
2 managers
6 employees
4 departments
3 projects
12 tasks
multiple assignments
24 manual time entries
2 devices
3 DWG mappings
120+ activity records across recent dates
```

Use these primary presentation records:

```text
manager@worklens.demo
employee@worklens.demo -> Mehmet Yilmaz
ABC AVM Electrical Project
A Block Electrical Drawing
ABC_A_Block.dwg
```

Hash demo passwords using `bcryptjs.hash(password, 12)` and document only a demo-specific password, never a personal password.

Run:

```bash
pnpm db:seed
```

Expected: rerunning the command produces the same logical demo dataset without duplicate unique-key failures.

- [ ] **Step 8: Verify data layer**

Run:

```bash
pnpm test
pnpm build
```

Expected: PASS and build succeeds with generated Prisma types.

- [ ] **Step 9: Commit**

```bash
git add prisma prisma.config.ts apps/web/src/lib/db.ts apps/web/src/server/domain

git commit -m "feat: add WorkLens data model and demo seed"
```

---

## Task 3: Auth.js, RBAC, Tenant Isolation, and Consistent API Errors

**Files:**
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/types/next-auth.d.ts`
- Create: `apps/web/src/server/auth/context.ts`
- Create: `apps/web/src/server/http/api-response.ts`
- Create: `apps/web/src/server/http/errors.ts`
- Create: `apps/web/src/app/login/login-form.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Test: `apps/web/src/server/auth/context.test.ts`
- Test: `apps/web/src/server/http/api-response.test.ts`

**Interfaces:**
- Consumes: `db`, `User`, `Employee`, `Company` from Task 2.
- Produces: Auth.js `auth`; session fields `user.id`, `user.companyId`, `user.role`, `user.employeeId`; `requireUser()`, `requireManager()`, `requireEmployee()`; `ApiError`; `ok(data)` and `fail(error)` helpers.

- [ ] **Step 1: Write failing authorization helper tests**

Create tests that assert:

```ts
expect(() => assertRole({ role: "EMPLOYEE" }, ["MANAGER"])).toThrow("FORBIDDEN");
expect(assertRole({ role: "MANAGER" }, ["MANAGER"])).toBeUndefined();
```

and tenant predicates always include the session company:

```ts
expect(tenantWhere("company-a", { id: "employee-1" })).toEqual({
  id: "employee-1",
  companyId: "company-a"
});
```

Run the test and expect failure because helpers are absent.

- [ ] **Step 2: Implement Auth.js credentials login**

Create `apps/web/src/auth.ts` using the current Auth.js Next.js pattern:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          employeeId: user.employeeId
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as never;
      session.user.companyId = token.companyId as string;
      session.user.employeeId = (token.employeeId as string | null) ?? null;
      return session;
    }
  },
  pages: { signIn: "/login" }
});
```

Create the route handler:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Implement typed auth context and tenant helper**

Create `apps/web/src/server/auth/context.ts` exposing:

```ts
export async function requireUser(): Promise<AuthContext>;
export async function requireManager(): Promise<AuthContext>;
export async function requireEmployee(): Promise<AuthContext & { employeeId: string }>;
export function assertRole(ctx: Pick<AuthContext, "role">, allowed: UserRole[]): void;
export function tenantWhere<T extends object>(companyId: string, where: T): T & { companyId: string };
```

`requireEmployee()` must fail if an EMPLOYEE-role user lacks an `employeeId` link.

- [ ] **Step 4: Implement consistent API errors**

Create `apps/web/src/server/http/errors.ts`:

```ts
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public status: number) {
    super(message);
  }
}
```

Create `api-response.ts` with:

```ts
export const ok = <T>(data: T, init?: ResponseInit) => Response.json({ data }, init);
export const fail = (error: ApiError) => Response.json(
  { error: { code: error.code, message: error.message } },
  { status: error.status }
);
```

- [ ] **Step 5: Implement the shadcn login form and role redirect**

The form posts credentials through Auth.js and redirects:

```text
MANAGER -> /dashboard
EMPLOYEE -> /my-dashboard
```

Show one generic error for invalid credentials; do not reveal whether an email exists.

- [ ] **Step 6: Protect manager and employee route groups**

In each route-group layout call the relevant auth helper and redirect unauthorized users to the correct landing page or `/login`. Do not rely only on sidebar visibility.

- [ ] **Step 7: Run authorization tests and build**

```bash
pnpm --filter web test src/server/auth src/server/http
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Manual security smoke test**

Use the seeded accounts:

```text
manager@worklens.demo -> /dashboard allowed
employee@worklens.demo -> /my-dashboard allowed
employee@worklens.demo -> /dashboard blocked/redirected
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/auth.ts apps/web/src/app/api/auth apps/web/src/types apps/web/src/server/auth apps/web/src/server/http apps/web/src/app/login

git commit -m "feat: add authentication and tenant-aware authorization"
```

---

## Task 4: Manager Project, Task, Employee, and Assignment Vertical Slice

**Files:**
- Create: `apps/web/src/server/services/projects.ts`
- Create: `apps/web/src/server/services/tasks.ts`
- Create: `apps/web/src/server/services/employees.ts`
- Create: `apps/web/src/app/api/projects/route.ts`
- Create: `apps/web/src/app/api/tasks/route.ts`
- Create: `apps/web/src/app/api/tasks/[id]/assignments/route.ts`
- Create: `apps/web/src/app/(manager)/dashboard/page.tsx`
- Create: `apps/web/src/app/(manager)/employees/page.tsx`
- Create: `apps/web/src/app/(manager)/projects/page.tsx`
- Create: `apps/web/src/app/(manager)/projects/[id]/page.tsx`
- Create: `apps/web/src/app/(manager)/tasks/page.tsx`
- Create: `apps/web/src/app/(manager)/tasks/[id]/page.tsx`
- Create: `apps/web/src/components/projects/create-project-dialog.tsx`
- Create: `apps/web/src/components/tasks/create-task-dialog.tsx`
- Create: `apps/web/src/components/tasks/assign-employee-dialog.tsx`
- Test: `apps/web/src/server/services/tasks.test.ts`

**Interfaces:**
- Consumes: auth context, tenant helpers, Prisma models, task date rule.
- Produces: tenant-safe manager services and UI for employee/project/task/assignment CRUD required by the demo.

- [ ] **Step 1: Write failing task-assignment service tests**

Test these cases with mocked repository calls:

```text
manager can assign same-company employee
cross-company employee is rejected
cross-company task is not found
same employee cannot be assigned twice
past due date is rejected on task creation
```

The duplicate case must map to `CONFLICT`, not a raw database error.

- [ ] **Step 2: Implement Zod schemas for project/task mutations**

In the service files define schemas such as:

```ts
const createTaskSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  estimatedMinutes: z.number().int().positive().max(100_000).optional(),
  dueDate: z.coerce.date().optional()
});
```

Call `assertDueDateNotPast` before insert.

- [ ] **Step 3: Implement tenant-safe manager services**

Every read/mutation must include `companyId: ctx.companyId` in the initial database lookup. Never fetch by public ID and check company ownership after returning data to the caller.

Use transactions for:

```text
create task + initial assignments + audit log
assign employee + audit log
```

- [ ] **Step 4: Implement route handlers**

Each route:

```text
requireManager -> parse Zod body/query -> call service -> ok(data)
```

Catch `ApiError` and return `fail(error)`; convert unexpected errors to `INTERNAL_ERROR` without leaking stack traces in JSON.

- [ ] **Step 5: Build the manager dashboard shell with seeded metrics**

`/dashboard` shows four primary KPI cards:

```text
Employees
Today's Active Time
Today's Idle Time
Overdue Tasks
```

For tonight, data comes from PostgreSQL seed; activity-specific advanced aggregations are replaced in Task 7.

- [ ] **Step 6: Build polished employees/projects/tasks list pages**

Use shadcn table/badge primitives. Each table needs:

```text
loading skeleton
empty message
success rows
error/retry state where client fetching is used
```

Use status/priority badges consistently.

- [ ] **Step 7: Build create/assign dialogs**

Use `react-hook-form + zodResolver`. On success:

```text
close dialog
show toast/inline success
refresh route data
```

On server validation errors, display the returned message adjacent to the form rather than swallowing it.

- [ ] **Step 8: Verify the full manager CRUD story manually**

From a fresh seeded database:

```text
login manager
create project
create task with future due date
assign Mehmet
open task detail
verify assignment visible
attempt past due date -> rejected
attempt duplicate assignment -> rejected
```

- [ ] **Step 9: Run tests/build and commit**

```bash
pnpm test
pnpm lint
pnpm build
git add apps/web
git commit -m "feat: add manager project and task workflow"
```

---

## Task 5: Employee Dashboard, Task Status, Manual Time, and Own-Data Authorization

**Files:**
- Create: `apps/web/src/server/services/employee-self.ts`
- Create: `apps/web/src/server/services/time-entries.ts`
- Create: `apps/web/src/app/api/my/tasks/[id]/route.ts`
- Create: `apps/web/src/app/api/my/time-entries/route.ts`
- Create: `apps/web/src/app/(employee)/my-dashboard/page.tsx`
- Create: `apps/web/src/app/(employee)/my-tasks/page.tsx`
- Create: `apps/web/src/app/(employee)/my-time/page.tsx`
- Create: `apps/web/src/app/(employee)/my-projects/page.tsx`
- Create: `apps/web/src/components/time/add-time-entry-dialog.tsx`
- Test: `apps/web/src/server/services/employee-self.test.ts`
- Test: `apps/web/src/server/services/time-entries.test.ts`

**Interfaces:**
- Consumes: `requireEmployee`, manual-time domain rules, Prisma models.
- Produces: employee self-service pages; `createOwnTimeEntry(ctx, input)`; `updateOwnAssignedTaskStatus(ctx, taskId, status)`; overlap protection.

- [ ] **Step 1: Write failing own-data authorization tests**

Cover:

```text
employee can read own assignments
employee cannot update task not assigned to them
employee cannot create time entry for another employee
employee cannot use project from another company
```

The service input must not contain `employeeId`; derive it from `ctx.employeeId`.

- [ ] **Step 2: Write failing overlap test**

Given existing:

```text
09:00–12:00
```

reject each of:

```text
11:30–13:00
08:00–09:30
09:30–10:30
```

and allow:

```text
12:00–13:00
```

- [ ] **Step 3: Implement manual-time creation**

`createOwnTimeEntry` must:

```text
validate timestamps
calculate duration server-side
verify company/project/task ownership
verify task belongs to selected project when taskId exists
query overlap for ctx.employeeId
insert TimeEntry
insert AuditLog in the same transaction
```

Use overlap predicate:

```ts
startAt < input.endAt && endAt > input.startAt
```

- [ ] **Step 4: Implement employee task status updates**

Permit only tasks with an existing `TaskAssignment` for `ctx.employeeId`. The employee may update status but not priority, assignees, estimate, project, or deadline.

- [ ] **Step 5: Build employee pages**

`/my-dashboard`:

```text
today manual time
assigned/in-progress task count
recent task list
activity summary cards initially backed by seeded Activity rows; Task 7 replaces the basic query with final reusable aggregation services
```

`/my-tasks`: own assignments with status selector.

`/my-time`: own time entries + Add Time Entry dialog.

`/my-projects`: distinct projects derived from own assignments.

- [ ] **Step 6: Verify date UX and server validation**

The browser form prevents selecting future date/time where practical, but the server remains authoritative. Manually submit a future timestamp through devtools/curl and confirm the API still returns `VALIDATION_ERROR`.

- [ ] **Step 7: Run tests/build and commit**

```bash
pnpm test
pnpm lint
pnpm build
git add apps/web
git commit -m "feat: add employee task and manual time workflows"
```

---

## Task 6: Device Registration, Agent Authentication, Heartbeat, and Activity Batch Ingestion

**Files:**
- Create: `apps/web/src/server/agent/token.ts`
- Create: `apps/web/src/server/agent/authenticate.ts`
- Create: `apps/web/src/server/agent/activity-schema.ts`
- Create: `apps/web/src/server/services/devices.ts`
- Create: `apps/web/src/server/services/activities.ts`
- Create: `apps/web/src/app/api/agent/register/route.ts`
- Create: `apps/web/src/app/api/agent/heartbeat/route.ts`
- Create: `apps/web/src/app/api/agent/activities/batch/route.ts`
- Test: `apps/web/src/server/agent/token.test.ts`
- Test: `apps/web/src/server/services/activities.test.ts`

**Interfaces:**
- Consumes: Device/Activity/FileMapping models, manager auth, `normalizeFileName`.
- Produces: `createAgentToken()`, `hashAgentToken(raw)`, `authenticateDevice(request)`, `ingestActivityBatch(device, events)`, and all three required agent endpoints.

- [ ] **Step 1: Write failing token tests**

Assert:

```ts
const token = createAgentToken();
expect(token).toMatch(/^worklens_agent_/);
expect(hashAgentToken(token)).toHaveLength(64);
expect(hashAgentToken(token)).toBe(hashAgentToken(token));
```

Also assert different tokens hash differently.

- [ ] **Step 2: Implement device token generation and hashing**

Use `crypto.randomBytes(32)` for token entropy and HMAC-SHA256 with `AGENT_TOKEN_PEPPER` for stored hashes:

```ts
createHmac("sha256", env.AGENT_TOKEN_PEPPER).update(rawToken).digest("hex")
```

Never log the raw token.

- [ ] **Step 3: Implement manager device registration**

`POST /api/agent/register` is manager-authenticated for the demo and accepts:

```json
{ "employeeId": "...", "name": "MEHMET-PC" }
```

Validate employee belongs to manager company. Generate a public `deviceId`, store token hash, return raw token once:

```json
{
  "data": {
    "deviceId": "PC-...",
    "token": "worklens_agent_..."
  }
}
```

- [ ] **Step 4: Implement device authentication**

Require:

```text
Authorization: Bearer <token>
X-Device-ID: <deviceId>
```

Lookup by public `deviceId`, reject revoked/missing device, compare token hashes with `timingSafeEqual`, and return the trusted `device + employee + company` context.

- [ ] **Step 5: Write failing activity validation/idempotency tests**

Cover:

```text
invalid token rejected
batch > 100 rejected
unsupported type rejected
endAt <= startAt rejected
event longer than 6 hours rejected
agent-supplied employeeId/companyId ignored or schema-rejected
duplicate eventId creates one Activity only
unmapped DWG remains projectId/taskId null
mapped DWG receives configured project/task
```

- [ ] **Step 6: Implement strict batch schema**

Each event is:

```ts
const agentActivitySchema = z.object({
  eventId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  type: z.enum(["APPLICATION", "IDLE", "COMPUTER_LOCK", "COMPUTER_UNLOCK", "SYSTEM_START", "SYSTEM_STOP"]),
  applicationName: z.string().max(160).nullable().optional(),
  processName: z.string().max(260).nullable().optional(),
  windowTitle: z.string().max(1000).nullable().optional(),
  fileName: z.string().max(500).nullable().optional()
}).strict();
```

Batch schema is `z.object({ activities: z.array(agentActivitySchema).min(1).max(100) }).strict()`.

- [ ] **Step 7: Implement ingestion with server-derived identity**

For each validated event:

```text
durationSeconds = floor((endAt-startAt)/1000)
reject durationSeconds <= 0 or durationSeconds > 21_600 (6 hours)
normalize fileName if present
lookup FileMapping for device.companyId
insert Activity with companyId/employeeId/device database id from authenticated device
use event project/task mapping only from FileMapping
```

Use `createMany({ skipDuplicates: true })` only if it preserves the mapping fields needed; otherwise upsert each event by `(deviceId,eventId)` within a transaction. The behavior must be idempotent either way.

- [ ] **Step 8: Implement heartbeat**

`POST /api/agent/heartbeat` accepts only:

```json
{ "agentVersion": "0.1.0", "timestamp": "2026-08-31T20:00:00Z" }
```

Update `lastSeenAt` using server time, not the agent timestamp. Store agent version. UI online state is computed as `lastSeenAt >= now - 90 seconds`.

- [ ] **Step 9: Run agent API tests and commit**

```bash
pnpm --filter web test src/server/agent src/server/services/activities.test.ts
pnpm build
git add apps/web
git commit -m "feat: add secure agent activity ingestion"
```

---

## Task 7: DWG Mapping, Activity Aggregations, Manager Employee Detail, and Reports

**Files:**
- Create: `apps/web/src/server/services/file-mappings.ts`
- Create: `apps/web/src/server/services/activity-reports.ts`
- Create: `apps/web/src/app/api/file-mappings/route.ts`
- Create: `apps/web/src/app/api/activities/route.ts`
- Create: `apps/web/src/app/api/reports/employee/route.ts`
- Create: `apps/web/src/app/api/reports/project/route.ts`
- Create: `apps/web/src/app/api/reports/task/route.ts`
- Create: `apps/web/src/app/(manager)/employees/[id]/page.tsx`
- Create: `apps/web/src/app/(manager)/activities/page.tsx`
- Create: `apps/web/src/app/(manager)/reports/page.tsx`
- Create: `apps/web/src/app/(employee)/my-activity/page.tsx`
- Create: `apps/web/src/components/activity/activity-timeline.tsx`
- Create: `apps/web/src/components/activity/application-breakdown.tsx`
- Create: `apps/web/src/components/file-mappings/map-file-dialog.tsx`
- Test: `apps/web/src/server/services/activity-reports.test.ts`

**Interfaces:**
- Consumes: Activity/TimeEntry/FileMapping data and manager/employee auth.
- Produces: `getEmployeeDaySummary`, `getProjectSummary`, `getTaskSummary`, `manualActivityDifference`, file mapping UI/API, activity timeline and application breakdown.

- [ ] **Step 1: Write failing aggregation tests**

Use a fixed fixture:

```text
APPLICATION AutoCAD 09:00–10:00 mapped ABC AVM
IDLE        10:00–10:30
APPLICATION Chrome  10:30–11:00 unmapped
Manual Time 09:00–11:00 = 120 min
```

Expect:

```text
active = 90 min
idle = 30 min
AutoCAD = 60 min
Chrome = 30 min
project ABC AVM activity = 60 min
manual = 120 min
manual - activity = 30 min
```

- [ ] **Step 2: Implement aggregation services with explicit semantics**

Never expose a combined `workedTime`. Return separate fields:

```ts
type EmployeeDaySummary = {
  activeSeconds: number;
  idleSeconds: number;
  manualMinutes: number;
  differenceMinutes: number;
  applications: Array<{ name: string; durationSeconds: number }>;
};
```

`differenceMinutes = manualMinutes - round(activeSeconds / 60)`.

- [ ] **Step 3: Implement manual file mapping service**

Manager submits:

```json
{ "fileName": "ABC_A_Block.dwg", "projectId": "...", "taskId": "..." }
```

Validate project/task/company relationships. Normalize filename server-side. Upsert on `(companyId, normalizedFileName)` and audit the create/update.

Do not retroactively rewrite historical Activity rows in this two-day demo; new ingested events resolve the mapping. Seed historical mapped activities already contain project/task IDs.

- [ ] **Step 4: Build the high-value manager employee detail page**

Header:

```text
Mehmet Yilmaz | Electrical | ACTIVE | Agent Online/Offline
```

Cards:

```text
Today's Active
Today's Idle
Manual Time
Assigned/In-Progress Tasks
```

Below cards:

```text
application duration chart/list
activity timeline
current/assigned tasks
Manual vs Activity comparison
```

Timeline rows display application, window/file, project/task if mapped, and `Unmapped` badge otherwise.

- [ ] **Step 5: Add live polling without WebSockets**

Use a small client component that refetches employee activity every 5 seconds while the page is visible. Stop polling on component unmount. Keep the existing data visible during refresh to avoid flashing skeletons every 5 seconds.

- [ ] **Step 6: Build Employee `my-activity` using the same components**

The employee route does not accept arbitrary employee ID. It derives `ctx.employeeId` server-side and passes only own data into the shared timeline/application components.

- [ ] **Step 7: Build reports page**

Provide four tabs:

```text
Employee Summary
Project Summary
Task Summary
Manual vs Activity
```

At minimum support date + employee/project filter where applicable. Keep charts limited to one useful application breakdown and one project tracked-vs-estimate visualization.

- [ ] **Step 8: Run aggregation/security tests and manual polling test**

```bash
pnpm test
pnpm build
```

Then insert a new activity through curl and verify it appears on employee detail in <= 10 seconds without page reload.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat: add activity dashboards and reports"
```

---

## Task 8: Python Agent Core, SQLite Queue, Batch Uploader, Heartbeat, and Simulator

**Files:**
- Create: `apps/agent/pyproject.toml`
- Create: `apps/agent/.env.example`
- Create: `apps/agent/worklens_agent/config.py`
- Create: `apps/agent/worklens_agent/models.py`
- Create: `apps/agent/worklens_agent/segmenter.py`
- Create: `apps/agent/worklens_agent/queue.py`
- Create: `apps/agent/worklens_agent/client.py`
- Create: `apps/agent/worklens_agent/simulator.py`
- Create: `apps/agent/worklens_agent/main.py`
- Test: `apps/agent/tests/test_segmenter.py`
- Test: `apps/agent/tests/test_queue.py`
- Test: `apps/agent/tests/test_client.py`

**Interfaces:**
- Consumes: `/api/agent/heartbeat`, `/api/agent/activities/batch`, device ID/token from Task 6.
- Produces: `Observation`, `ActivitySegment`, `SegmentBuilder`, durable `ActivityQueue`, `AgentClient`, and `python -m worklens_agent.main --mode simulate`.

- [ ] **Step 1: Create the Python project**

Create `apps/agent/pyproject.toml`:

```toml
[project]
name = "worklens-agent"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "httpx>=0.27,<1",
  "python-dotenv>=1,<2",
  "psutil>=6,<8"
]

[project.optional-dependencies]
windows = ["pywin32>=306"]
test = ["pytest>=8,<10"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

Create `.env.example`:

```env
WORKLENS_API_URL=https://your-hosted-demo.example.com
WORKLENS_DEVICE_ID=PC-001
WORKLENS_AGENT_TOKEN=worklens_agent_replace_me
WORKLENS_IDLE_THRESHOLD_SECONDS=300
WORKLENS_EXCLUDED_PROCESSES=1password.exe,keepass.exe
```

- [ ] **Step 2: Write the failing segmentation tests**

Create fixtures representing observations every 2 seconds. Assert the segmenter emits exactly:

```text
AutoCAD ABC_A_Block.dwg
Chrome
IDLE
```

when state transitions occur.

Also test a 5-minute unchanged AutoCAD activity flushes a segment and immediately begins another same-state segment.

- [ ] **Step 3: Implement agent models and segment builder**

`Observation` fields:

```python
@dataclass(frozen=True)
class Observation:
    at: datetime
    kind: Literal["APPLICATION", "IDLE", "SKIP"]
    application_name: str | None
    process_name: str | None
    window_title: str | None
    file_name: str | None
```

`ActivitySegment` includes UUID `event_id`, start/end, type, and optional app/window/file fields. Its persisted/uploaded type is `APPLICATION` or `IDLE` for the demo.

`SegmentBuilder.observe(observation) -> list[ActivitySegment]` closes when meaningful state changes or `max_segment_seconds=300` is reached. A `SKIP` observation closes any current tracked segment at `observation.at` and starts no replacement segment, so excluded applications are neither captured nor miscounted as idle.

- [ ] **Step 4: Write the failing durable queue tests**

Test:

```text
enqueue survives reopening database
pending returns unsent rows oldest-first
mark_uploaded removes row from pending results
batch returns at most 100 rows
```

Use a temporary SQLite path from pytest.

- [ ] **Step 5: Implement SQLite queue**

Use Python stdlib `sqlite3`. Table:

```sql
CREATE TABLE IF NOT EXISTS pending_activity (
  event_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  uploaded_at TEXT NULL
);
```

Persist closed segments before any upload attempt.

- [ ] **Step 6: Implement authenticated HTTP client**

Headers:

```python
{
  "Authorization": f"Bearer {token}",
  "X-Device-ID": device_id,
  "Content-Type": "application/json"
}
```

`upload_pending()` sends maximum 100 events to `/api/agent/activities/batch`. Only after a 2xx response are those exact queue rows marked uploaded.

`send_heartbeat()` posts agent version every 30 seconds. Network exceptions are logged and swallowed by the uploader loop; they never terminate collection.

- [ ] **Step 7: Implement simulator collector**

Simulator emits a repeatable demonstration sequence with short demo durations:

```text
AutoCAD / ABC_A_Block.dwg
Chrome
AutoCAD / ABC_B_Block.dwg
IDLE
Excel
```

Use the same `SegmentBuilder -> SQLite -> AgentClient` path as real mode. Do not call the API directly from the simulator.

- [ ] **Step 8: Implement agent main loop**

`main.py` supports:

```bash
python -m worklens_agent.main --mode simulate
python -m worklens_agent.main --mode real
```

Main loop responsibilities:

```text
collector observations every ~2 seconds
segment builder
queue closed segments immediately
uploader attempt every ~15 seconds
heartbeat every ~30 seconds
flush current segment on clean shutdown
```

- [ ] **Step 9: Run agent tests**

```bash
cd apps/agent
python -m venv .venv
source .venv/bin/activate
pip install -e ".[test]"
pytest -q
```

Expected: PASS without requiring Windows.

- [ ] **Step 10: End-to-end simulator test against hosted/local API**

Register a device in the web app, set agent env vars, run simulator, and verify:

```text
heartbeat changes device to online
activity rows enter database
timeline updates
ABC_A_Block.dwg resolves through FileMapping
retrying the same eventId does not duplicate totals
```

- [ ] **Step 11: Commit**

```bash
git add apps/agent
git commit -m "feat: add offline-capable activity agent simulator"
```

---

## Task 9: Windows Foreground/Idle Collector and AutoCAD DWG Extraction

**Files:**
- Create: `apps/agent/worklens_agent/windows_collector.py`
- Create: `apps/agent/worklens_agent/autocad.py`
- Test: `apps/agent/tests/test_autocad.py`
- Modify: `apps/agent/worklens_agent/main.py`

**Interfaces:**
- Consumes: `Observation` and the existing segment/queue/client pipeline.
- Produces: `extract_dwg_filename(window_title) -> str | None`; `WindowsCollector.observe() -> Observation`; real mode connected to agent core.

- [ ] **Step 1: Write AutoCAD parser tests without Windows**

Cover at least:

```python
("Autodesk AutoCAD 2026 - [ABC_A_Block.dwg]", "ABC_A_Block.dwg")
("AutoCAD - C:\\Projects\\ABC_B_Block.DWG", "ABC_B_Block.DWG")
("Autodesk AutoCAD 2026", None)
("Chrome - ABC_A_Block.dwg documentation", None)
```

Run and expect failure because parser is absent.

- [ ] **Step 2: Implement conservative DWG extraction**

Only call extraction when process name identifies AutoCAD. Regex must return a basename ending in `.dwg` case-insensitively and return `None` when no reliable match exists. Never infer a project from arbitrary text.

- [ ] **Step 3: Implement Windows foreground process/window detection**

Use `win32gui.GetForegroundWindow`, `win32process.GetWindowThreadProcessId`, and `psutil.Process(pid).name()`.

Return safe fallback values when a process exits between PID lookup and process inspection; do not crash the loop.

- [ ] **Step 4: Implement idle duration**

Use `GetLastInputInfo` through Win32/ctypes. When `idle_seconds >= config.idle_threshold_seconds`, emit an IDLE observation with no window title/file details.

This reads only elapsed time since last input and never records keystrokes.

- [ ] **Step 5: Enforce excluded-process privacy**

If process name normalized lowercase is present in `WORKLENS_EXCLUDED_PROCESSES`, return `Observation(kind="SKIP", ...)` with all application/window/file fields `None`. `SegmentBuilder` closes the prior tracked segment and emits no segment for the excluded period; excluded time is therefore neither captured nor mislabeled as idle.

- [ ] **Step 6: Connect real mode**

`--mode real` must instantiate `WindowsCollector`. On non-Windows systems, fail at startup with a clear message:

```text
Real collector requires Windows. Use --mode simulate on this machine.
```

- [ ] **Step 7: Run cross-platform tests**

```bash
cd apps/agent
pytest -q tests/test_autocad.py tests/test_segmenter.py tests/test_queue.py
```

Expected: PASS on any OS.

- [ ] **Step 8: Windows smoke test when a Windows machine is available**

Run:

```powershell
pip install -e ".[windows,test]"
python -m worklens_agent.main --mode real
```

Verify normal apps appear. If AutoCAD is available, verify an active `.dwg` title extracts. If AutoCAD is unavailable, do not block the demo; simulator remains the official fallback.

- [ ] **Step 9: Commit**

```bash
git add apps/agent
git commit -m "feat: add Windows activity collector"
```

---

## Task 10: Audit Logging, Error/Empty States, Demo-Safe UX, and Security Regression Tests

**Files:**
- Create: `apps/web/src/server/audit/log.ts`
- Create: `apps/web/src/components/states/data-error.tsx`
- Create: `apps/web/src/components/states/empty-state.tsx`
- Create: `apps/web/src/components/states/page-skeleton.tsx`
- Create: `apps/web/src/server/security/security-regressions.test.ts`
- Modify: relevant mutation services to use audit helper and relevant pages to use state components.

**Interfaces:**
- Consumes: all existing manager/employee/device/activity services.
- Produces: central `writeAudit(tx, entry)` helper; consistent error/empty/loading presentation; regression suite for tenant/role/device boundaries.

- [ ] **Step 1: Centralize audit log writes**

Expose:

```ts
writeAudit(tx, {
  companyId,
  actorUserId,
  action,
  entityType,
  entityId,
  metadata
})
```

Use it in project creation, task creation, assignment/reassignment, manual time create/update, and file mapping create/update.

- [ ] **Step 2: Write the security regression suite**

Cover the following exact invariants:

```text
Employee A cannot read Employee B activity.
Manager Company A cannot read Company B employee by guessing ID.
Manager Company A cannot assign Company B employee.
Employee cannot create project/task.
Employee cannot set another employee ID in a time entry payload.
Invalid/revoked agent token is rejected.
Agent cannot supply companyId/employeeId fields in strict payload.
Duplicate event cannot increase activity total.
Past new deadline is rejected.
Future manual time is rejected.
Overlapping manual time is rejected.
```

Tests can call service functions with mocked/authenticated contexts; at least the agent payload and auth tests should exercise the route/service validation boundary.

- [ ] **Step 3: Add standard UI states**

Every high-value route must visibly handle:

```text
Loading -> Skeleton
Empty -> concise EmptyState
Error -> DataError with Retry when client fetch is used
Success -> normal content
```

Do not render blank sections with undefined/NaN totals.

- [ ] **Step 4: Add destructive confirmations only where needed**

Use shadcn `AlertDialog` for removing assignment, deleting/editing time where exposed, and archiving a project if implemented. Do not add confirmation to normal status changes or creation flows.

- [ ] **Step 5: Run the complete web test suite and build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "test: harden demo security and failure states"
```

---

## Task 11: Deploy Web + PostgreSQL and Prepare Clean Handoff README

**Files:**
- Create: `README.md`
- Create: `apps/agent/README.md`
- Modify: `.env.example`
- Modify: `apps/web/package.json` / root scripts only if deployment requires it.

**Interfaces:**
- Consumes: completed web, seed, agent simulator.
- Produces: public hosted URL, managed PostgreSQL data, documented demo accounts, documented simulator/agent setup, known limitations.

- [ ] **Step 1: Create managed PostgreSQL and production environment variables**

Set:

```text
DATABASE_URL
AUTH_SECRET
NEXTAUTH_URL
AGENT_TOKEN_PEPPER
```

Use different production secrets from development. Never paste production secrets into README, source, seed, screenshots, or commits.

- [ ] **Step 2: Apply migrations and seed production demo data**

Run:

```bash
pnpm db:deploy
pnpm db:seed
```

Expected: committed migrations apply successfully and the deterministic demo seed completes once against production.

Verify primary records exist:

```text
manager@worklens.demo
employee@worklens.demo
ABC AVM Electrical Project
ABC_A_Block.dwg mapping
```

- [ ] **Step 3: Deploy Next.js**

Configure Vercel to build the workspace web app from the repository root. Use build command:

```bash
pnpm build
```

and install command:

```bash
pnpm install --frozen-lockfile
```

Set all production environment variables in Vercel.

- [ ] **Step 4: Verify deployment in a private/incognito browser**

Test both accounts from a browser with no existing local session:

```text
manager login -> dashboard
employee login -> own dashboard
logout -> login page
```

- [ ] **Step 5: Write the root README**

Use this exact structure:

```text
# WorkLens
Workforce & Project Activity Tracking Platform

## Problem
## Demo Scope
## Architecture
## Core Features
## Tech Stack
## Hosted Demo
## Demo Accounts
## Repository Structure
## Web Setup
## Desktop Agent
## Simulator Mode
## Activity Pipeline
## Offline Queue and Idempotency
## AutoCAD/DWG Strategy
## Security and Privacy
## Known Limitations
## Future Improvements
```

Include an ASCII architecture diagram showing Web -> PostgreSQL and Agent/Simulator -> Agent API.

- [ ] **Step 6: Write the agent README**

Document Python setup, `.env`, device registration, simulator command, real Windows command, privacy behavior, excluded processes, and the fact that simulator exercises the real backend pipeline.

- [ ] **Step 7: Run secret scan by inspection**

Run:

```bash
git grep -nE 'DATABASE_URL=.+|AUTH_SECRET=.+|AGENT_TOKEN_PEPPER=.+' -- ':!*.example'
git status --short
```

Expected: no real secrets are present in tracked files.

- [ ] **Step 8: Commit**

```bash
git add README.md apps/agent/README.md .env.example apps/web/package.json pnpm-lock.yaml

git commit -m "docs: prepare WorkLens demo handoff"
```

---

## Task 12: Full Thursday Demo Verification and Freeze

**Files:**
- Create: `docs/demo-script.md`
- Create: `docs/demo-checklist.md`
- Modify: only files required to fix verified demo-blocking defects. Do not add new features.

**Interfaces:**
- Consumes: entire completed system.
- Produces: rehearsed demo path, proven fallback hierarchy, final frozen release candidate.

- [ ] **Step 1: Reset and reseed the demo state**

Ensure the hosted database contains polished historical data before live activity begins. The system must already be impressive if the live agent never starts.

- [ ] **Step 2: Execute the complete automated verification**

Run locally:

```bash
pnpm test
pnpm lint
pnpm build
cd apps/agent && pytest -q
```

Expected: all PASS.

- [ ] **Step 3: Execute the full smoke checklist**

Check every box:

```text
[ ] Manager login works
[ ] Employee login works
[ ] Dashboard loads
[ ] Create project works
[ ] Create task works
[ ] Assignment works
[ ] Employee sees assignment
[ ] Employee changes task status
[ ] Manual time entry works
[ ] Future manual date is rejected
[ ] Past new task deadline is rejected
[ ] Simulator authenticates
[ ] Heartbeat changes device status
[ ] Activity batch uploads
[ ] Timeline updates within 10 seconds
[ ] Idle event displays separately
[ ] AutoCAD/DWG event displays
[ ] DWG mapping resolves project/task
[ ] Activity totals update without double counting
[ ] Manual and Activity totals remain separate
[ ] Employee cannot access another employee activity
[ ] Logout/login works
[ ] Hosted URL works in incognito/private window
```

- [ ] **Step 4: Prove every fallback level that is available**

Fallback order:

```text
1. Real Windows agent + AutoCAD, if available and reliable
2. Real Windows agent + any normal application
3. Simulator through real API pipeline
4. Seeded historical activity
```

The demo script must never require Level 1.

- [ ] **Step 5: Write the presentation script**

Create `docs/demo-script.md` with this five-scene flow:

```text
1. Manager dashboard: company metrics and recent activity.
2. ABC AVM project: task estimate/status/assignment.
3. Mehmet employee detail: active, idle, manual, app breakdown, timeline.
4. Start simulator/agent: AutoCAD + ABC_A_Block.dwg appears live and maps to project/task.
5. Manual vs Activity: explain the neutral difference and the three-time-concept design.
```

Keep the spoken demo focused on business value plus 3–4 engineering decisions: tenant isolation, device auth, offline queue, idempotent batch upload, simulator fallback.

- [ ] **Step 6: Freeze scope after successful rehearsal**

Once the complete hosted demo works twice consecutively:

```text
No new features.
Only fix defects that can break the exact demo path, security boundary, deployment, or README handoff.
```

- [ ] **Step 7: Tag the demo commit**

```bash
git status --short
git tag -a demo-thursday -m "WorkLens internship demo"
```

Expected: clean working tree before the tag.

---

# Wednesday Cut Line

If the project is behind schedule Wednesday, cut in this order without damaging the main story:

1. Remove secondary report filters/charts.
2. Remove task detail polish beyond the essential fields.
3. Remove optional device-management UI; keep registration endpoint/script.
4. Remove audit-log viewing UI; keep audit writes.
5. Skip real AutoCAD validation if no environment is available; keep parser tests + simulator.
6. Skip real Windows collection if environment blocks it; simulator remains mandatory.

Never cut:

```text
Auth/RBAC
Tenant scoping
Manager dashboard
Project/task/assignment
Employee own-task/manual-time flow
Agent authentication
Simulator
Activity ingestion/idempotency
Activity timeline
DWG mapping
Manual vs Activity separation
Seeded demo data
Hosted deployment
```

# Definition of Done

The project is done for Thursday when:

```text
A reviewer can open the hosted URL, log in as Manager, inspect a project/task/employee,
start a real or simulated activity producer, watch AutoCAD/DWG activity arrive through the
real API/database pipeline, see it mapped to the correct project/task, compare manual and
automated time without double counting, switch to Employee and see only that employee's
own data, and understand from the README how the architecture, security, offline queue,
and fallback strategy work.
```

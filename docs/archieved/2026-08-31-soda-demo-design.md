# SODA Workforce & Project Tracking Demo — Design Specification

**Date:** 2026-08-31  
**Status:** Approved design, pre-implementation  
**Target:** Internship demo on Thursday  
**Primary requirements source:** `SODA MANAGEMENT.pdf`

## 1. Objective

Build a polished, hosted vertical-slice demo of the SODA workforce and project tracking platform in two development days, with Wednesday reserved for integration, hardening, deployment, and presentation rehearsal.

The demo must prove the platform's central business relationship:

```text
Employee
  -> Project
  -> Task
  -> Manual Time / Activity Time
  -> Desktop Activity
  -> Application
  -> AutoCAD
  -> DWG File
```

The demo is not intended to implement the entire long-term product. It should demonstrate the core end-to-end workflow convincingly, preserve the architecture required by the source specification, and avoid features that add delivery risk without strengthening the Thursday presentation.

## 2. Success Criteria

The demo is successful when a reviewer can see, in one hosted system:

1. A manager logs in and sees workforce/project metrics.
2. Employees, projects, tasks, assignments, estimates, status, priority, and deadlines are represented.
3. An employee logs in and sees only their own assignments, projects, time entries, and activity.
4. The employee can update an assigned task status and create a valid manual time entry.
5. A desktop activity producer sends activity through the real agent API contract.
6. The system records active application/window usage and idle periods.
7. AutoCAD activity can carry a `.dwg` filename when detection succeeds or is simulated.
8. A DWG filename can be manually mapped to a project/task.
9. Manager screens show an employee activity timeline and application duration totals.
10. Manual time and automated activity time are displayed separately with a neutral difference value.
11. Tenant scoping, role authorization, secure device authentication, validation, and basic audit logging are present in the backend.
12. The hosted demo remains usable even if Windows or AutoCAD cannot be demonstrated live.

## 3. Scope Strategy

### 3.1 Thursday scope

#### Manager

- Login/logout
- Dashboard
- Employees list
- Employee detail
- Projects list/detail
- Tasks list/detail
- Create project
- Create task
- Assign one or more employees to a task
- Task status, priority, estimate, and deadline
- View manual time
- View tracked activity
- Employee application usage
- Employee daily activity timeline
- Project tracked-time summary
- Manual-vs-activity comparison
- Basic reports
- Device/agent status where needed for the demo
- Manual DWG file mapping

#### Employee

- Login/logout
- My dashboard
- My tasks
- Update status of assigned tasks
- My time
- Create manual time entry
- My activity
- My projects

#### Desktop agent

- Windows-oriented Python implementation
- Device authentication
- Foreground application detection
- Active window title detection
- Idle detection
- AutoCAD process recognition
- Best-effort DWG filename extraction from window title
- Activity segmentation
- SQLite local queue
- Batch upload
- Heartbeat
- Simulator mode using the same queue/uploader/API contract

### 3.2 Explicitly deferred

- ClickUp integration
- Kolay IK integration
- Clockify import
- AI reporting or recommendations
- Productivity scoring
- Advanced anomaly detection
- Automatic project matching
- Deep AutoCAD API/plugin integration
- Screenshot capture
- Keylogging
- Advanced notification system
- Excel/CSV export
- Polished desktop installer/updater
- Mobile app
- WebSockets
- Microservices
- Redis/background-job infrastructure
- Kubernetes or other deployment complexity
- Full Super Admin UX
- Complete settings/integrations UI

## 4. Architecture

### 4.1 Repository shape

```text
soda-demo/
├─ apps/
│  ├─ web/                 # Next.js UI + API routes
│  └─ agent/               # Python Windows agent + simulator
├─ prisma/                 # Prisma schema, migrations, seed
├─ docs/
│  └─ superpowers/specs/
├─ .env.example
└─ README.md
```

A monorepo-style layout is used for clarity and handoff, but the web application remains a single Next.js deployment rather than a separate frontend and backend service.

### 4.2 Runtime architecture

```text
Manager / Employee
        |
        v
+-----------------------------+
| Next.js Web                 |
| - React UI                  |
| - shadcn/ui                 |
| - Auth / RBAC               |
| - API routes                |
| - Business logic            |
| - Reports / aggregations    |
+--------------+--------------+
               |
             Prisma
               |
               v
          PostgreSQL
               ^
               |
             HTTPS
               |
      +--------+---------+
      |                  |
Python Windows Agent   Simulator
      |
Active app/window
Idle detector
AutoCAD/DWG detector
Segment builder
SQLite queue
Batch uploader
Heartbeat
```

The simulator is not a fake dashboard path. It replaces only the platform-specific collector and uses the same segment builder, SQLite queue, authentication, uploader, validation, API, database, and dashboard pipeline as the real agent.

## 5. Technology Choices

### Web

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- React Hook Form
- Zod
- Recharts for a small number of useful dashboard charts

TanStack Table is optional and should only be added if standard shadcn tables become insufficient.

### Backend/data

- Next.js API route handlers / server-side business logic
- PostgreSQL
- Prisma ORM
- Auth.js credentials authentication
- bcrypt password hashing

### Desktop agent

- Python
- Win32/pywin32-style APIs for foreground window/process data
- `GetLastInputInfo`-style idle detection
- SQLite for durable local queueing
- HTTP client for heartbeat and batch uploads

## 6. Data Model

### 6.1 Company

```text
Company
- id
- name
- createdAt
- updatedAt
```

The demo UI exposes one company, but tenant ownership remains structurally enforced.

### 6.2 User

```text
User
- id
- companyId
- email
- passwordHash
- role
- employeeId?
- createdAt
- updatedAt
```

Roles:

```text
SUPER_ADMIN
MANAGER
EMPLOYEE
```

The demo focuses on MANAGER and EMPLOYEE. SUPER_ADMIN is schema-supported but does not require a polished interface.

### 6.3 Employee

```text
Employee
- id
- companyId
- firstName
- lastName
- email
- phone?
- departmentId?
- position?
- managerId?
- status
- hireDate?
- createdAt
- updatedAt
```

Statuses:

```text
ACTIVE
INACTIVE
SUSPENDED
```

### 6.4 Department

```text
Department
- id
- companyId
- name
- managerId?
- createdAt
- updatedAt
```

### 6.5 Project

```text
Project
- id
- companyId
- name
- code
- description?
- clientName?
- status
- startDate?
- endDate?
- estimatedHours?
- createdById
- createdAt
- updatedAt
```

Statuses:

```text
PLANNED
ACTIVE
ON_HOLD
COMPLETED
ARCHIVED
```

### 6.6 Task

```text
Task
- id
- companyId
- projectId
- parentTaskId?
- title
- description?
- createdById
- status
- priority
- estimatedMinutes?
- dueDate?
- completedAt?
- createdAt
- updatedAt
```

Statuses:

```text
TODO
IN_PROGRESS
BLOCKED
REVIEW
COMPLETED
CANCELLED
```

Priorities:

```text
LOW
MEDIUM
HIGH
URGENT
```

### 6.7 TaskAssignment

The source requirements say tasks can have one or multiple assignees, so assignment is normalized into a join table rather than a single `assigned_to` field.

```text
TaskAssignment
- id
- companyId
- taskId
- employeeId
- assignedAt
- assignedById
```

Constraint:

```text
unique(taskId, employeeId)
```

### 6.8 TimeEntry

```text
TimeEntry
- id
- companyId
- employeeId
- projectId
- taskId?
- startAt
- endAt
- durationMinutes
- notes?
- createdAt
- updatedAt
```

`durationMinutes` is calculated server-side from `startAt` and `endAt`.

### 6.9 Device

```text
Device
- id
- companyId
- employeeId
- deviceId
- name
- agentTokenHash
- agentVersion?
- lastSeenAt?
- status
- createdAt
- updatedAt
```

The raw agent token is returned only at registration and is never stored in plaintext.

### 6.10 Activity

```text
Activity
- id
- companyId
- employeeId
- deviceId
- eventId
- startAt
- endAt
- durationSeconds
- applicationName?
- processName?
- windowTitle?
- fileName?
- projectId?
- taskId?
- type
- createdAt
```

Types:

```text
APPLICATION
IDLE
COMPUTER_LOCK
COMPUTER_UNLOCK
SYSTEM_START
SYSTEM_STOP
```

Constraint:

```text
unique(deviceId, eventId)
```

This makes batch retries idempotent.

### 6.11 FileMapping

```text
FileMapping
- id
- companyId
- normalizedFileName
- displayFileName
- projectId
- taskId?
- createdById
- createdAt
- updatedAt
```

Constraint:

```text
unique(companyId, normalizedFileName)
```

### 6.12 AuditLog

```text
AuditLog
- id
- companyId
- actorUserId
- action
- entityType
- entityId
- metadataJson
- createdAt
```

Minimum audited mutations:

- Project created
- Task created
- Task assigned/reassigned
- Manual time created/updated
- File mapping created/updated

## 7. Authentication and Authorization

### 7.1 Web authentication

Credentials flow:

```text
email + password
  -> password hash verification
  -> Auth.js session
  -> userId + companyId + role
```

Passwords are hashed with bcrypt. Secrets are environment variables.

### 7.2 RBAC

#### Manager

May:

- Read company employees/projects/tasks/activities/reports
- Create projects/tasks
- Assign employees
- View manual and automated time
- Manage manual file mappings
- Register/view devices as needed for the demo

#### Employee

May:

- Read own assigned tasks
- Update status of own assigned tasks
- Read own projects
- Create/read own manual time entries
- Read own activity

May not:

- View another employee's activity/time
- Create projects
- Assign tasks
- Access another company's records

### 7.3 Tenant isolation

Every tenant-owned server operation scopes by authenticated `companyId` in addition to any resource ID.

Example conceptual rule:

```text
resource.id = requestedId
AND resource.companyId = session.companyId
```

The demo uses application/API-level tenant enforcement rather than PostgreSQL Row Level Security. RLS can be added later as defense in depth.

## 8. Agent Authentication

The desktop agent does not use the employee's web credentials.

Device registration produces:

```text
deviceId
agentToken
```

The database stores only `agentTokenHash`.

Requests include a bearer token and device identifier. The backend authenticates the device and derives:

```text
Device -> Employee -> Company
```

The server does not trust agent-supplied `employeeId` or `companyId` values.

## 9. Agent Collection Model

### 9.1 Polling

The Windows collector checks foreground state approximately every 2 seconds.

Each observation contains:

```text
timestamp
process name
window title
idle duration
```

No keyboard contents, passwords, screenshots, or clipboard data are collected.

### 9.2 Segment builder

Raw polling observations are not uploaded individually.

A current activity segment is maintained and is closed when any meaningful state changes:

- Application changes
- Window title changes
- AutoCAD/DWG filename changes
- Idle state changes
- Computer lock/unlock when supported
- Agent stops
- Segment reaches a periodic flush boundary

A long-running unchanged application segment is split approximately every 5 minutes so current activity can reach the dashboard without waiting for an application switch.

### 9.3 Idle behavior

Default idle threshold: 5 minutes.

When the threshold is reached:

- Current APPLICATION segment closes.
- An IDLE segment begins.
- Idle time is not counted as active project/application time.

For the demo, idle starts when the configured threshold is reached rather than being backdated to the user's last input.

### 9.4 AutoCAD behavior

AutoCAD detection is intentionally shallow:

1. Detect an AutoCAD process such as `acad.exe`.
2. Read the active window title.
3. Attempt to extract a `.dwg` filename using known title patterns/regex.
4. Store application/process/window regardless of whether filename extraction succeeds.
5. If a filename is available, normalize it and resolve `FileMapping` server-side.

Failure to identify a file does not discard AutoCAD activity.

## 10. Offline Queue and Upload

### 10.1 Local queue

Closed segments are written to SQLite before upload attempts.

Conceptual queue record:

```text
id
eventId
payloadJson
createdAt
uploadedAt?
```

Collector operation does not depend on successful network access.

### 10.2 Batch upload

Upload approximately every 15 seconds or when the pending queue reaches a reasonable threshold.

Endpoint:

```text
POST /api/agent/activities/batch
```

Maximum batch size for the demo: 100 events.

Backend validates:

- Authenticated device
- Supported activity type
- Parseable timestamps
- `endAt > startAt`
- Reasonable event duration
- Bounded string lengths
- Bounded batch size

Duplicate `(deviceId, eventId)` events are ignored safely.

### 10.3 Heartbeat

Endpoint:

```text
POST /api/agent/heartbeat
```

Frequency: approximately every 30 seconds.

Device is treated as offline for UI purposes if no heartbeat has been seen for roughly 90 seconds.

## 11. Simulator Mode

The agent supports:

```text
real
simulate
```

Simulator mode produces realistic sequences such as:

```text
AutoCAD -> ABC_A_Block.dwg
Chrome
AutoCAD -> ABC_B_Block.dwg
Idle
Excel
```

It uses the same:

- Segment builder
- SQLite queue
- Event IDs
- Authentication
- Batch uploader
- Server validation
- Database storage

The simulator exists so the hosted demo does not depend on having a working Windows + AutoCAD environment.

## 12. Manual Time Rules

Manual time and automated activity are permanently separate datasets.

The system must never calculate:

```text
worked time = manual time + activity time
```

For a manual time entry:

- `startAt < endAt`
- Start/end cannot be in the future
- Duration is calculated server-side
- Employee/project/task ownership must be valid
- Obvious overlaps for the same employee are rejected for the demo

Historical edits are audited.

## 13. Task and Date Rules

For new tasks:

- A due date in the past is rejected.
- An existing task is allowed to naturally become overdue.
- Assignment must reference an employee in the same company as the task/project.
- Duplicate assignment is rejected by the unique constraint.

## 14. File Mapping Rules

Filename normalization:

- Trim
- Extract basename if a path is provided
- Compare case-insensitively via normalized lowercase value

Example variants:

```text
C:\Projects\ABC_A_Block.dwg
ABC_A_Block.DWG
abc_a_block.dwg
```

resolve to the same normalized key.

If no mapping exists, activity remains visible as `Unmapped`. The server does not infer or invent a project/task from the filename.

## 15. Privacy and Exclusions

The demo follows the requirements' privacy framing: workplace activity measurement, not spyware.

Never collect:

- Keystroke contents
- Passwords
- Screenshots
- Clipboard contents

Sensitive/excluded processes are configured in the agent. For an excluded process, no window title or filename is captured and the event may be skipped entirely.

A simple environment/config value is sufficient for Thursday; a settings UI is deferred.

## 16. API Shape

Representative web API areas:

```text
/api/auth/*
/api/employees/*
/api/projects/*
/api/tasks/*
/api/time-entries/*
/api/activities/*
/api/reports/*
/api/file-mappings/*
/api/devices/*
```

Representative agent endpoints:

```text
POST /api/agent/register
POST /api/agent/heartbeat
POST /api/agent/activities/batch
```

All application endpoints return consistent success/error shapes.

Success:

```json
{
  "data": {}
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deadline cannot be in the past."
  }
}
```

Minimum error codes:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INTERNAL_ERROR
```

## 17. UI Design

### 17.1 Visual system

Use shadcn/ui and Tailwind to produce a clean B2B SaaS dashboard with:

- Left navigation sidebar
- Compact top header
- KPI cards
- Status/priority badges
- Tables
- Dialog-based creation flows
- Timeline rows
- Limited charts where they add clear value
- Skeletons, empty states, and retryable error states

Avoid custom animation-heavy design.

### 17.2 Manager routes

```text
/login
/dashboard
/employees
/employees/:id
/projects
/projects/:id
/tasks
/tasks/:id
/activities
/reports
```

`/settings` and `/integrations` are deferred or clearly non-functional/future work rather than partially built.

### 17.3 Employee routes

```text
/my-dashboard
/my-tasks
/my-time
/my-activity
/my-projects
```

### 17.4 High-value employee detail page

Show:

- Employee identity/department/status
- Agent online/offline state
- Today's active time
- Today's idle time
- Today's manual time
- Current/assigned task information
- Application duration breakdown
- Activity timeline
- AutoCAD/DWG filename where available
- Project/task mapping where available

### 17.5 Reports for Thursday

Keep reports narrow:

- Employee summary
- Project summary
- Task summary
- Manual vs activity comparison

Filtering can be minimal but should support the most useful dimensions, especially date and employee/project where practical.

## 18. Dashboard Data Semantics

Keep these concepts independent:

### Manual Time

Sum validated `TimeEntry` duration.

### Activity Time

Sum `Activity.durationSeconds` where `type = APPLICATION`.

### Idle Time

Sum `Activity.durationSeconds` where `type = IDLE`.

### Project Activity

Sum application activity mapped to the selected project.

### Manual vs Activity Difference

Show the absolute or signed difference clearly and neutrally. Do not interpret the difference as proof that an employee did or did not work.

## 19. Reliability and Edge Cases

### Web/API

- Invalid dates rejected server-side
- Future manual time rejected
- Past due date rejected only when creating/updating into an invalid past value
- Cross-tenant IDs return not found/forbidden without exposing data
- Employee cannot access another employee's activity
- Assignment must stay within company
- Duplicate assignment rejected
- Overlapping manual entries rejected
- Unmapped files remain visible
- Missing AutoCAD filename still records AutoCAD activity
- Unknown applications are recorded dynamically

### Agent

- Network failure never stops collection
- Backend failure leaves events queued
- Agent restart preserves unsent SQLite rows
- Duplicate retries do not double-count
- Long unchanged activity is periodically flushed
- Invalid/malformed server responses do not crash the collector
- Excluded processes do not expose sensitive titles

### UI

Every important data screen has:

- Loading state
- Success state
- Empty state
- Error state with retry where useful

Destructive operations use confirmation dialogs. Ordinary creation/update flows do not add unnecessary confirmation friction.

## 20. Demo Seed Data

Seed enough data to make the system look active before any live collection runs.

Recommended dataset:

```text
1 company
2 managers
6 employees
4 departments
3 projects
10-15 tasks
20-30 manual time entries
100+ historical activity events
2 devices
3 DWG mappings
```

Primary presentation project:

```text
ABC AVM Electrical Project
```

Primary employee:

```text
Mehmet Yilmaz
```

Primary task:

```text
A Block Electrical Drawing
```

Primary mapped file:

```text
ABC_A_Block.dwg
```

The seeded dataset should support the full presentation without requiring a live agent.

## 21. Demo Story

### Scene 1 — Manager dashboard

Show company-level workforce/project metrics and recent activity.

### Scene 2 — Project/task

Open `ABC AVM Electrical Project`, then show `A Block Electrical Drawing` assigned to Mehmet with estimate, status, and deadline.

### Scene 3 — Employee activity

Open Mehmet and show:

- Active time
- Idle time
- Manual time
- Application breakdown
- Daily timeline

### Scene 4 — Live activity

Run the real Windows agent if reliable; otherwise run simulator mode.

Produce an event such as:

```text
AutoCAD
ABC_A_Block.dwg
```

After normal polling, the web UI shows the new activity and its resolved project/task mapping.

### Scene 5 — Manual vs activity

Show separate values, for example:

```text
Manual:   6h 00m
Activity: 5h 17m
Difference: 43m
```

Describe it as an activity/manual difference that a manager may review, not an accusation or productivity verdict.

## 22. Demo Fallback Hierarchy

1. Real Windows agent + AutoCAD
2. Real Windows agent + another application
3. Simulator using the real API pipeline
4. Seeded historical activity

The presentation must not have a single point of failure tied to Windows, AutoCAD, or network timing.

## 23. Deployment and Handoff

### Hosted demo

Recommended shape:

```text
Git repository
  -> Vercel (Next.js)
  -> Managed PostgreSQL
```

Managed PostgreSQL may be provided by Neon, Supabase Postgres, Railway, or another simple provider chosen during deployment.

### Repository handoff

Required:

- Clean source structure
- `.env.example`
- Seed script
- README
- Demo account instructions
- Agent setup instructions
- Simulator instructions
- Architecture explanation
- Security/privacy notes
- Known limitations
- Future improvements

One-command perfect local setup is not a Thursday requirement.

## 24. Environment Variables

Web example:

```text
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_URL=
AGENT_TOKEN_PEPPER=
```

Agent example:

```text
SODA_API_URL=
SODA_DEVICE_ID=
SODA_AGENT_TOKEN=
SODA_IDLE_THRESHOLD_SECONDS=300
SODA_EXCLUDED_PROCESSES=
```

Actual secret files must not be committed.

## 25. Testing Strategy

Testing is focused on high-risk business and security behavior rather than broad coverage.

### Unit tests

- Duration calculation
- Past/future date validation
- Manual-time overlap detection
- Filename normalization
- AutoCAD filename extraction
- Activity segmentation
- Manual/activity difference calculation

### API/integration tests

- Manager can access same-company employee data
- Employee cannot access another employee's data
- Cross-company resource access is blocked
- Invalid agent token is rejected
- Duplicate activity event does not double-count
- Invalid activity timestamps/types are rejected
- Assignment cannot cross companies

### Agent tests

Given observations such as:

```text
AutoCAD
AutoCAD
AutoCAD
Chrome
Chrome
Idle
```

expect exactly the appropriate AutoCAD, Chrome, and Idle segments.

### Manual smoke checklist before presentation

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
[ ] Invalid/future dates are rejected
[ ] Simulator authenticates
[ ] Heartbeat appears
[ ] Activity uploads
[ ] Timeline updates
[ ] Idle event displays
[ ] AutoCAD/DWG event displays
[ ] DWG mapping resolves project/task
[ ] Activity totals update
[ ] Manual-vs-activity comparison works
[ ] Logout/login works
[ ] Hosted URL works in incognito/private window
```

## 26. Implementation Priority Principle

For the Thursday deadline:

> If a feature does not materially improve the end-to-end presentation story or protect a critical security/data-integrity invariant, do not build it.

Priority order is:

1. Working vertical data flow
2. Demo reliability
3. Correct authorization/data semantics
4. Polished high-value screens
5. Nice-to-have breadth

## 27. Non-Goals and Known Limitations

The Thursday build is a demonstration-grade vertical slice, not a claim that the complete production specification is finished.

Known intentional limitations:

- One company shown in UI despite tenant-aware backend model
- No polished Super Admin UX
- No deep AutoCAD plugin/API integration
- No advanced anomaly or productivity scoring
- No integrations with ClickUp/Kolay IK/Clockify
- No database RLS in the demo
- No production desktop installer/updater
- Simple polling instead of WebSockets
- Minimal report/filter breadth

These limitations must be documented transparently in the README and presentation if asked.

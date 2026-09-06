# Technical Design — V1 Completion Release

## 1. Objective

Extend the existing architecture without introducing unnecessary infrastructure or breaking the working web/agent pipeline.

## 2. Architecture Constraints

Keep the current overall model:

```text
Web UI / Next.js API
        |
      Prisma
        |
    PostgreSQL
        ^
        |
      HTTPS
        |
Windows Agent
  -> collector
  -> segment builder
  -> SQLite queue
  -> batch uploader
  -> heartbeat
```

Do not introduce Redis, microservices, WebSockets, or background-job infrastructure for this release unless an existing blocker requires it.

## 3. Data Model Changes

### 3.1 CompanyTrackingSettings

Recommended model:

```text
CompanyTrackingSettings
- id
- companyId
- idleThresholdSeconds
- configVersion
- createdAt
- updatedAt
```

Constraint:

```text
unique(companyId)
```

### 3.2 ExcludedApplication

Recommended normalized model:

```text
ExcludedApplication
- id
- companyId
- processName
- displayName?
- createdAt
- updatedAt
```

Constraint:

```text
unique(companyId, processName)
```

Store normalized process names in a consistent case.

### 3.3 Notification

For this release, a persisted Notification table is optional.

Preferred simple approach:

- Derive deadline-approaching and overdue notifications from tasks when requested.
- Persist read/dismiss state only if needed.

If read-state persistence is required:

```text
NotificationReadState
- id
- userId
- notificationKey
- readAt
```

Avoid introducing a general event-processing framework.

### 3.4 AuditLog

Continue using the existing AuditLog model. Expand mutation coverage instead of introducing a second logging model.

### 3.5 Departments

Use the existing Department model from the current schema/design if present. Add missing API/UI functionality rather than redesigning the entity.

## 4. Agent Configuration Distribution

### 4.1 Goal

Avoid a new frequent configuration polling loop.

### 4.2 Heartbeat response

Extend the heartbeat response with:

```json
{
  "data": {
    "configVersion": 7
  }
}
```

The agent stores its last applied version locally.

When the version changes:

```text
heartbeat
  -> configVersion changed
  -> GET /api/agent/config
  -> validate response
  -> persist local config
  -> apply config
```

### 4.3 Agent configuration payload

Example:

```json
{
  "data": {
    "idleThresholdSeconds": 300,
    "excludedProcesses": [
      "whatsapp.exe",
      "1password.exe"
    ],
    "configVersion": 7
  }
}
```

The backend derives company/device context from authenticated device identity. The agent must not choose its own company ID.

## 5. Excluded Application Behavior

If a process is excluded:

- Do not capture sensitive window title
- Do not capture filename
- Prefer skipping detailed APPLICATION activity for that process, or record only an explicit neutral excluded state if the existing data model requires continuity
- Do not accidentally retain previously captured titles after exclusion becomes active

The exact chosen behavior must be consistent across agent logic, reports, and privacy documentation.

Recommended for this release: skip detailed activity events for excluded processes.

## 6. Lock / Unlock Detection

### 6.1 Event types

Use the existing activity types:

```text
COMPUTER_LOCK
COMPUTER_UNLOCK
```

### 6.2 Behavior

On lock:

1. Close the active APPLICATION segment.
2. Emit a COMPUTER_LOCK event.
3. Prevent locked time from being counted as active application usage.

On unlock:

1. Emit a COMPUTER_UNLOCK event.
2. Resume normal foreground collection.

Do not emit repeated lock/unlock events while state remains unchanged.

## 7. Agent Tray Architecture

The tray UI should read primarily from local agent state:

- Connection state
- Current application
- Current project/task mapping if already available locally
- Active/idle totals accumulated locally
- Agent version

Avoid separate rapid API polling.

If project/task labels are not locally available, use existing mapping responses/cached metadata rather than adding frequent requests.

## 8. Manual Time Editing

### 8.1 API behavior

Recommended endpoint:

```text
PATCH /api/time-entries/:id
```

### 8.2 Validation

- Authenticated user can edit only eligible entries
- Employee may edit only their own entry
- Manager behavior follows existing authorization rules
- `startAt < endAt`
- No future timestamps
- Server recalculates duration
- Project/task belong to the same company
- Task belongs to selected project if task is present
- Overlap detection reruns after excluding the current entry

### 8.3 Audit metadata

Store:

```json
{
  "before": {},
  "after": {},
  "reason": "Forgot to stop timer"
}
```

Do not rely only on display text for historical changes.

## 9. Department APIs

Representative routes:

```text
GET    /api/departments
POST   /api/departments
GET    /api/departments/:id
PATCH  /api/departments/:id
```

All queries must scope by authenticated `companyId`.

Manager assignment must reference a valid same-company employee/user according to the existing model.

## 10. Super Admin Authorization

Super Admin routes must require:

```text
role = SUPER_ADMIN
```

Company-scoped manager routes must remain company-scoped even after Super Admin functionality is added.

Do not weaken existing tenant isolation by adding generic unscoped repository helpers.

### Required admin capabilities

- Company create/read/update/status
- User create/read/update/status/role
- Audit/system-log read
- System-level settings surface where defined
- Integration configuration/status surface without actual V2 synchronization

## 11. Audit Coverage

Audit at minimum:

```text
COMPANY_CREATED
COMPANY_UPDATED
COMPANY_STATUS_CHANGED
USER_CREATED
USER_UPDATED
USER_STATUS_CHANGED
USER_ROLE_CHANGED
DEPARTMENT_CREATED
DEPARTMENT_UPDATED
PROJECT_CREATED
PROJECT_UPDATED
TASK_CREATED
TASK_UPDATED
TASK_ASSIGNED
TASK_REASSIGNED
TIME_ENTRY_CREATED
TIME_ENTRY_UPDATED
TIME_ENTRY_DELETED
TRACKING_SETTINGS_UPDATED
EXCLUDED_APPLICATION_ADDED
EXCLUDED_APPLICATION_REMOVED
INTEGRATION_SETTINGS_UPDATED
```

Use existing action naming conventions if they already exist; do not create duplicates with inconsistent vocabulary.

## 12. Notification Derivation

At request time, classify tasks:

```text
OVERDUE
DUE_SOON
```

Recommended default due-soon window:

```text
24 hours
```

If the existing product semantics suggest another value, use a clear constant/configuration rather than scattering logic across the UI.

Do not classify completed/cancelled tasks as overdue.

## 13. Filtering Architecture

Filtering should be server-backed for large activity/report datasets.

Recommended query parameters:

```text
from
to
employeeId
departmentId
projectId
taskId
application
type
status
page
pageSize
```

Rules:

- Validate all IDs
- Apply tenant scope first
- Apply role scope second
- Apply filters third
- Bound page size
- Add database indexes only where actual query plans need them

## 14. Security Requirements

The release must preserve:

- Session/auth security
- Password hashing
- Device-token hashing/storage
- HTTPS in production
- Role-based authorization
- Tenant isolation
- Validation
- Rate limiting where already implemented
- Secure secrets in environment variables
- No hardcoded agent tokens

Add regression tests around new Super Admin and tracking-settings surfaces because both touch sensitive boundaries.

## 15. Installer and Versioning

Changes to the agent require:

- Version bump
- Rebuilt installer
- Production API URL validation
- Clean install test
- Startup-on-login test
- Upgrade/reinstall test
- Device token persistence test
- Tray startup test
- Heartbeat test
- Activity upload test
- Config refresh test
- Lock/unlock test

## 16. Non-Goals

Do not add:

- ClickUp API logic
- Kolay İK API logic
- Clockify import jobs
- AI infrastructure
- anomaly scoring engine
- automatic DWG inference
- export subsystem
- WebSockets
- Redis
- microservices

# Requirements and Scope — V1 Completion Release

## 1. Purpose

This document maps the four-day release to the original WorkLens/SODA requirements and distinguishes V1 completion work from later-phase functionality.

## 2. Source-Aligned V1 Requirements Addressed in This Release

### 2.1 Department Management

The requirements define a Department entity containing:

```text
id
company_id
name
manager_id
created_at
updated_at
```

This release adds a usable management UI and supporting CRUD flows.

### 2.2 Super Admin

The requirements define a Super Admin role with authority to:

- Create companies
- Manage companies
- Manage users
- Manage system settings
- Manage integrations
- View system logs

This release implements the V1 administration experience for these responsibilities. Integration management in this release means configuration/status surfaces only; actual ClickUp, Kolay İK, and Clockify synchronization remains deferred.

### 2.3 Computer Lock / Unlock

The activity model explicitly supports:

```text
COMPUTER_LOCK
COMPUTER_UNLOCK
```

The desktop agent will capture explicit Windows lock/unlock state changes and upload them as events.

### 2.4 Company-Configurable Tracking Settings

The requirements specify that the idle threshold can be changed from company settings and that sensitive applications can be excluded from tracking.

Release settings:

```text
Idle threshold
Excluded applications/processes
```

No unnecessary tracking controls will be introduced beyond what is needed for the requirements.

### 2.5 Agent Tray UI

The requirements allow the agent to be visible in the system tray and show the employee current tracking state.

This release adds a lightweight tray experience showing:

- Connection state
- Current application
- Current mapped project/task where known
- Today's active time
- Today's idle time
- Agent version

The tray will not introduce user-controlled pause/stop tracking in this release.

### 2.6 Manual Time Entry Editing

The requirements state that incorrect historical manual time entries may be edited and that changes must be written to the audit log.

This release includes:

- Edit own eligible manual time entries
- Validate start/end times
- Recalculate duration server-side
- Reject invalid/future/overlapping edits
- Record previous and new values in the audit log
- Optional edit reason field

Manager approval of manual edits is not included because the requirements make that behavior optional.

### 2.7 Basic Notifications

The requirements describe simple notifications for:

- Task deadline approaching
- Task overdue

This release provides basic in-app notifications only.

Email, push notifications, event buses, WebSockets, or background notification infrastructure are not required.

### 2.8 Filtering

The requirements list the following filter dimensions:

- Date
- Employee
- Department
- Project
- Task
- Application
- Activity type
- Status

This release adds practical filtering across the screens where those dimensions are relevant.

### 2.9 Audit Logging

The requirements include audit logging for important mutations such as:

- User creation/deletion
- Task assignment/reassignment
- Project creation
- Manual time changes/deletion
- Settings changes
- Integration changes

This release expands existing audit coverage accordingly.

## 3. Existing V1 Capabilities That Must Not Regress

The release must preserve:

- Authentication
- Role-based authorization
- Tenant/company isolation
- Employee management
- Project management
- Task management
- Assignment
- Task status/priority/deadline
- Manual time creation
- Dashboard
- Employee detail
- Project detail
- Basic reports
- Windows agent
- Device registration
- Foreground application detection
- Active window detection
- Idle detection
- Login/logout/start/stop events where currently supported
- Heartbeat
- Local activity queue
- Batch upload
- AutoCAD detection
- Active DWG detection
- File duration tracking
- Manual DWG-to-project/task mapping
- Employee activity timeline
- Manual time vs activity comparison

## 4. Deferred V2 Scope

The source requirements place the following in later phases:

- ClickUp integration
- Kolay İK integration
- Clockify import
- Advanced reports
- Automatic project matching
- Advanced anomaly detection
- Better/deeper AutoCAD integration
- Advanced notifications
- Export to Excel/CSV

These items are not required for the four-day V1 completion release.

## 5. Deferred V3 Scope

The following remain future work:

- AI reporting
- AI project analysis
- Employee workload analysis
- Estimated-vs-actual prediction
- Automatic task/project classification
- Productivity insights
- Management recommendations

## 6. Important Data Semantics

The system must continue to distinguish:

```text
Manual Time
Activity Time
Project/Billable Time
```

This release does not add a new billable-time approval workflow.

Mapped application activity may be reported as project activity, but manual time and automated activity must never be summed together as a single "worked time" value.

## 7. Privacy Requirements

The release must preserve the privacy model:

- No keylogging
- No password capture
- No screenshot capture
- No clipboard capture
- Minimize unnecessary personal data collection
- Excluded applications must not expose sensitive window titles/file information

## 8. Scope Freeze Rule

Any request that introduces one of the deferred V2/V3 capabilities during the four-day release is recorded in the backlog and does not replace a committed V1 completion task unless a blocking business requirement forces reprioritization.

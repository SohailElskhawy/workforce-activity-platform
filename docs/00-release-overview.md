# WorkLens V1 Completion & UX Release

**Release window:** 4 days  
**Release type:** V1 completion and usability hardening  
**Primary requirements source:** `SODA MANAGEMENT.pdf`  
**Existing demo design source:** `2026-08-31-soda-demo-design.md`

## 1. Release Objective

Complete the remaining V1 gaps in the requirements while improving the web and desktop user experience so the system is clear, usable, and ready for controlled client use.

This release is not intended to implement V2/V3 functionality. Integrations, advanced anomaly detection, automatic project matching, exports, and AI remain outside this four-day release.

## 2. Current Baseline

The current system already provides the core end-to-end relationship:

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

The current implementation already covers the core manager and employee flows, device registration, active application/window tracking, idle tracking, heartbeat, local queueing, batch uploads, AutoCAD/DWG detection, manual DWG mapping, activity timeline, reports, and manual-vs-activity comparison.

## 3. Release Scope

### Included

- System-wide UI/UX improvement
- Department management UI
- Super Admin panel
- Company tracking settings
- Configurable idle threshold
- Excluded applications/processes
- Computer lock/unlock events
- Agent tray/status UI
- Manual time-entry editing with audit history
- Audit-log coverage improvement
- Broader filters across major screens and reports
- Basic in-app deadline notifications
- Agent version bump and installer rebuild
- Regression, security, tenant-isolation, and deployment testing
- Documentation and handoff updates

### Explicitly Excluded

- ClickUp integration
- Kolay İK integration
- Clockify import
- Automatic project/DWG matching
- Advanced anomaly detection
- Excel/CSV export
- AI reporting
- AI workload analysis
- AI predictions
- Automatic classification
- Productivity scoring
- Management recommendations

These excluded items belong to later phases in the source requirements.

## 4. Release Success Criteria

The release is successful when:

1. A Super Admin can manage companies and users and inspect system/audit logs.
2. A Manager can create and manage departments.
3. Company-level tracking settings can be configured from the web panel.
4. The desktop agent can consume updated tracking settings without excessive new polling.
5. Lock and unlock events are captured and displayed correctly.
6. The agent has a visible tray/status UI.
7. Manual time entries can be edited with validation and audit history.
8. Core data screens support practical filtering by relevant dimensions.
9. Deadline approaching and overdue states are visible through a basic notification experience.
10. Existing manager/employee functionality continues to work without regressions.
11. The Windows installer is rebuilt, tested, and points to the production deployment.
12. UI behavior is consistent, readable, responsive, and includes loading/empty/error states.

## 5. Release Principles

### 5.1 Do not increase agent traffic unnecessarily

Continue using:

```text
Foreground collection
  -> local aggregation
  -> local queue
  -> batch upload
```

Configuration checks should piggyback on heartbeat via a configuration version rather than introducing frequent polling.

### 5.2 Privacy remains a product requirement

The system must continue to avoid collecting:

- Keystroke contents
- Passwords
- Screenshots
- Clipboard contents

Excluded applications must remain protected from sensitive-title capture.

### 5.3 UI completeness is part of feature completeness

A feature is complete only when all applicable layers are complete:

```text
UI
API/business logic
authorization
tenant isolation
validation
audit logging
loading state
empty state
error state
testing
```

### 5.4 No V2/V3 scope creep

If a feature does not materially close a V1 requirement or improve usability/reliability for this release, it is deferred.

## 6. Four-Day Milestone

| Day | Primary Goal |
|---|---|
| Day 1 | UI foundation, Departments, Tracking Settings |
| Day 2 | Super Admin, Audit improvements, Manual Time editing |
| Day 3 | Agent lock/unlock, Tray UI, Filters, Notifications |
| Day 4 | UX polish, regression/security testing, installer, deployment, documentation |

Day 4 is reserved for stabilization and release work. Major new features should not be introduced on Day 4.

## 7. Definition of Release Complete

The release is complete when the acceptance checklist in `05-testing-and-acceptance.md` passes, the production deployment is updated, the new agent installer is validated, and all known limitations are documented.

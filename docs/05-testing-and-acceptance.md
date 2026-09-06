# Testing and Acceptance — V1 Completion Release

## 1. Purpose

This document is the release gate. The release is not considered complete until all critical acceptance checks pass or a known limitation is explicitly documented and accepted.

## 2. Role and Tenant Security

### Super Admin

- [ ] Can access Super Admin routes
- [ ] Can list companies
- [ ] Can create a company
- [ ] Can edit a company
- [ ] Can activate/deactivate a company
- [ ] Can list users
- [ ] Can create a user
- [ ] Can change role/company where valid
- [ ] Can activate/deactivate a user
- [ ] Can view system/audit logs

### Manager

- [ ] Cannot access Super Admin routes
- [ ] Can access only their own company data
- [ ] Can manage departments in own company
- [ ] Can manage tracking settings for own company
- [ ] Cannot read another company's departments/settings/users

### Employee

- [ ] Cannot access manager/admin routes
- [ ] Cannot view another employee's activity
- [ ] Cannot view another employee's manual time
- [ ] Can edit only eligible own manual time entries

### Cross-tenant attacks

- [ ] Replacing a resource ID with another company's ID does not expose data
- [ ] Filter parameters cannot bypass tenant isolation
- [ ] Tracking settings endpoint derives company from authenticated context
- [ ] Agent config derives company/employee from device authentication

## 3. Department Management

- [ ] Department list loads
- [ ] Empty state works
- [ ] Create department works
- [ ] Duplicate/invalid department validation works
- [ ] Edit department works
- [ ] Manager assignment works only for valid same-company entity
- [ ] Department detail shows employees
- [ ] Employee department assignment remains consistent
- [ ] Audit events are recorded

## 4. Tracking Settings

### Idle threshold

- [ ] Manager can view current idle threshold
- [ ] Manager can change threshold
- [ ] Invalid values are rejected
- [ ] `configVersion` increments
- [ ] Audit event is recorded

### Excluded applications

- [ ] Manager can add excluded application/process
- [ ] Manager can remove excluded application/process
- [ ] Duplicate normalized process is rejected/handled cleanly
- [ ] `configVersion` increments
- [ ] Audit event is recorded

## 5. Agent Configuration

- [ ] Heartbeat works with current valid token
- [ ] Heartbeat returns current config version
- [ ] Agent does not refetch config when version is unchanged
- [ ] Agent fetches config after version changes
- [ ] Agent persists last valid config
- [ ] Network failure does not stop activity collection
- [ ] Invalid config response does not crash agent
- [ ] Restart preserves config or safely refetches it

## 6. Excluded Application Privacy

For an excluded process:

- [ ] Window title is not captured
- [ ] Filename is not captured
- [ ] Sensitive metadata is not uploaded
- [ ] Previously active non-excluded segment closes correctly
- [ ] Switching back to non-excluded app resumes normal tracking
- [ ] Updating exclusions from web eventually applies through config version refresh

## 7. Lock / Unlock Events

- [ ] Lock closes current application segment
- [ ] Exactly one COMPUTER_LOCK event is produced per lock transition
- [ ] Unlock produces exactly one COMPUTER_UNLOCK event
- [ ] Locked duration is not counted as active application time
- [ ] Events survive offline queueing
- [ ] Batch retry does not duplicate events
- [ ] Timeline displays lock/unlock clearly

## 8. Agent Tray UI

- [ ] Tray icon appears on startup
- [ ] Connected state is correct
- [ ] Disconnected state is correct during network failure
- [ ] Current application updates correctly
- [ ] Project/task displays when mapping is known
- [ ] Active total is reasonable
- [ ] Idle total is reasonable
- [ ] Agent version is visible
- [ ] Open WorkLens action works
- [ ] Tray does not create excessive network requests

## 9. Manual Time Editing

- [ ] Employee can open an eligible own entry
- [ ] Existing values load correctly
- [ ] `startAt >= endAt` is rejected
- [ ] Future timestamps are rejected
- [ ] Server recalculates duration
- [ ] Same-employee overlap is rejected
- [ ] Current entry is excluded from self-overlap check
- [ ] Invalid project/task relationship is rejected
- [ ] Cross-company IDs are rejected
- [ ] Successful edit updates UI
- [ ] Audit log contains before/after values
- [ ] Reason is stored if supplied

## 10. Super Admin Audit/System Logs

- [ ] Logs load
- [ ] Filter by date works
- [ ] Filter by company works
- [ ] Filter by actor/user works
- [ ] Filter by action works
- [ ] Filter by entity type works
- [ ] Details are readable
- [ ] Secret values/tokens are not exposed

## 11. Required Audit Coverage

Verify audit records exist for applicable actions:

- [ ] Company created
- [ ] Company updated/status changed
- [ ] User created
- [ ] User role/status changed
- [ ] Department created/updated
- [ ] Project created/updated
- [ ] Task created/updated
- [ ] Task assigned/reassigned
- [ ] Time entry created
- [ ] Time entry updated
- [ ] Time entry deleted if deletion exists
- [ ] Tracking settings updated
- [ ] Excluded application added/removed
- [ ] Integration settings changed if editable

## 12. Filtering

### Activity

- [ ] Date
- [ ] Employee
- [ ] Department
- [ ] Project
- [ ] Application
- [ ] Activity type

### Tasks

- [ ] Employee
- [ ] Department
- [ ] Project
- [ ] Status
- [ ] Priority
- [ ] Deadline state

### Projects

- [ ] Status
- [ ] Relevant employee/department filters
- [ ] Date where supported

### Reports

- [ ] Date
- [ ] Employee
- [ ] Department
- [ ] Project
- [ ] Task
- [ ] Application
- [ ] Activity type
- [ ] Status

General:

- [ ] Filters combine correctly
- [ ] Invalid filter IDs do not expose data
- [ ] Pagination works
- [ ] URL/state behavior is stable
- [ ] Empty filtered result shows a useful empty state

## 13. Notifications

- [ ] Due-soon task appears
- [ ] Overdue task appears
- [ ] Completed task does not appear as overdue
- [ ] Cancelled task does not appear as overdue
- [ ] Manager sees relevant company/task notifications
- [ ] Employee sees only relevant own task notifications where applicable
- [ ] Empty state works

## 14. Existing Core Regression

### Authentication

- [ ] Manager login
- [ ] Employee login
- [ ] Super Admin login
- [ ] Logout
- [ ] Invalid credentials rejected

### Projects and tasks

- [ ] Create project
- [ ] Create task
- [ ] Assign employee
- [ ] Update task status
- [ ] Priority works
- [ ] Deadline validation still works

### Manual time

- [ ] Create entry
- [ ] Invalid/future dates rejected
- [ ] Overlap validation works
- [ ] Manual totals remain separate from activity totals

### Activity

- [ ] Foreground application collection
- [ ] Active window collection
- [ ] Idle tracking
- [ ] Heartbeat
- [ ] Local queue
- [ ] Batch upload
- [ ] Duplicate retry idempotency
- [ ] Activity timeline
- [ ] Application totals

### AutoCAD

- [ ] AutoCAD process recognized
- [ ] DWG filename detected when available
- [ ] Missing filename still records AutoCAD activity
- [ ] Manual mapping works
- [ ] Mapped project/task appears in UI

## 15. UI/UX Acceptance

Every major page must have:

- [ ] Loading state
- [ ] Success state
- [ ] Empty state
- [ ] Error state
- [ ] Clear page title
- [ ] Clear primary action
- [ ] Consistent spacing
- [ ] Consistent status labels
- [ ] No overlapping text
- [ ] No clipped controls at common desktop sizes
- [ ] Reasonable mobile/tablet behavior

Terminology must remain consistent:

```text
Manual Time
Activity Time
Idle Time
Tracked Project Activity
```

Do not label a manual/activity difference as proof of underperformance.

## 16. Installer Acceptance

- [ ] New version number is visible
- [ ] Installer builds successfully
- [ ] Clean install works
- [ ] Device activation works
- [ ] Credentials are stored securely as currently designed
- [ ] Agent starts automatically after Windows login/reboot
- [ ] Tray appears
- [ ] Heartbeat reaches production
- [ ] Activity reaches production
- [ ] Config refresh works
- [ ] Lock/unlock works
- [ ] Offline queue survives restart
- [ ] Reinstall/upgrade does not create unintended duplicate devices

## 17. Production Deployment Acceptance

- [ ] Database migration applied
- [ ] Production env vars verified
- [ ] HTTPS works
- [ ] Manager production login works
- [ ] Employee production login works
- [ ] Super Admin production login works
- [ ] Tracking settings save
- [ ] Agent receives updated settings
- [ ] Audit logs populate
- [ ] Notifications load
- [ ] No critical server errors in smoke test

## 18. Final Release Gate

Release only if:

- [ ] No known cross-tenant data leak
- [ ] No privilege escalation path found in tested flows
- [ ] Agent does not lose queued data during normal network failure/restart tests
- [ ] Core manager/employee flows work
- [ ] New installer works against production
- [ ] Remaining limitations are documented as V2/V3 or known V1 limitations

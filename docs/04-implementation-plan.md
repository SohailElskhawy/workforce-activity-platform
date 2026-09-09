# Four-Day Implementation Plan — V1 Completion Release

## 1. Execution Rule

Work in vertical slices. A task is not complete when only the UI exists.

Every feature should complete all applicable layers:

```text
schema/data
API/business logic
authorization/tenant isolation
validation
UI
loading/empty/error states
audit logging
testing
```

## 2. Day 1 — UX Foundation, Departments, Tracking Settings

### Goal

Create the shared UI foundation first, then use it for the new V1 administration screens.

### 2.1 Shared UI foundation

- [ ] Review current manager and employee navigation
- [x] Implement/standardize AppShell
- [x] Standardize PageHeader
- [x] Standardize breadcrumbs
- [x] Standardize KPI cards
- [x] Standardize DataTable pattern
- [x] Standardize FilterBar pattern
- [x] Standardize status and priority badges
- [x] Standardize loading skeletons
- [x] Standardize empty states
- [x] Standardize error states
- [x] Standardize form/dialog behavior
- [x] Standardize toast feedback
- [ ] Verify responsive behavior on main existing routes

### 2.2 Department management

- [x] Confirm existing Department schema
- [x] Add/fix department API endpoints
- [x] Add manager authorization and tenant scoping
- [x] Add department list page
- [x] Add create department flow
- [x] Add edit department flow
- [x] Add department manager assignment
- [x] Add department detail/member view
- [x] Ensure employee forms use department data consistently
- [x] Add audit events for department mutations
- [x] Add validation/error/empty states
- [x] Add tests

### 2.3 Tracking settings

- [x] Add `CompanyTrackingSettings` model if missing
- [x] Add `ExcludedApplication` model if using normalized table
- [x] Add migration
- [x] Add manager settings API
- [x] Add tenant authorization
- [x] Add tracking settings page
- [x] Add idle-threshold validation
- [x] Add excluded-app CRUD
- [x] Increment `configVersion` on relevant setting changes
- [x] Audit setting changes
- [x] Add tests

### Day 1 acceptance

- [ ] Departments are fully manageable by a Manager
- [ ] Tracking settings persist correctly
- [ ] Existing UI uses the new shared patterns without critical regressions

---

## 3. Day 2 — Super Admin, Audit, Manual Time Editing

### Goal

Complete remaining web-side V1 administration and audit requirements.

### 3.1 Super Admin shell and authorization

- [x] Add/verify SUPER_ADMIN authorization helper
- [x] Create admin route group/layout
- [x] Ensure manager routes remain company-scoped
- [x] Add admin overview

### 3.2 Company management

- [x] Company list
- [x] Company detail
- [x] Create company
- [x] Edit company
- [x] Activate/deactivate company
- [x] Company-level summary statistics
- [x] Validation
- [x] Audit events
- [x] Tests

### 3.3 User management

- [x] User list
- [x] Create user
- [x] Edit role
- [x] Assign company
- [x] Activate/deactivate user
- [x] Prevent invalid role/company combinations
- [x] Audit events
- [x] Tests

### 3.4 System logs

- [x] Add Super Admin system-log page
- [x] Reuse AuditLog source
- [x] Add filters by date/company/user/action/entity
- [x] Add readable detail view
- [x] Avoid exposing secrets/tokens in metadata

### 3.5 Integration management placeholder/status UI

- [x] Add integrations admin/settings screen
- [x] List ClickUp
- [x] List Kolay İK
- [x] List Clockify
- [ ] Clearly label as not configured/future integration where applicable
- [ ] Do not implement synchronization

### 3.6 Manual time editing

- [x] Add edit action to eligible manual entries
- [x] Add PATCH endpoint if missing
- [x] Validate ownership/authorization
- [x] Recalculate duration server-side
- [x] Reject future values
- [x] Reject invalid overlaps
- [x] Validate project/task relationship
- [x] Add optional reason
- [x] Write before/after audit metadata
- [x] Update UI after edit
- [x] Add tests

### 3.7 Audit pass

- [x] Review all required V1 mutations
- [x] Add missing audit events
- [x] Confirm tenant/company metadata
- [x] Confirm sensitive values are not stored

### Day 2 acceptance

- [ ] Super Admin can manage companies and users
- [ ] System logs are usable
- [ ] Manual time editing works and is audited
- [ ] Required audit coverage exists for V1 mutations

---

## 4. Day 3 — Agent Events, Tray UI, Filters, Notifications

### Goal

Complete desktop-agent V1 gaps and broad usability/reporting requirements.

### 4.1 Agent configuration refresh

- [x] Extend heartbeat response with `configVersion`
- [x] Add authenticated agent-config endpoint
- [x] Add local cached config
- [x] Fetch config only when version changes
- [x] Apply idle threshold dynamically
- [x] Apply excluded process list dynamically
- [x] Ensure malformed config does not crash agent
- [x] Add tests

### 4.2 Excluded applications

- [x] Normalize process names
- [x] Ensure excluded apps do not expose titles/files
- [x] Ensure changes apply after config refresh
- [x] Verify no stale sensitive metadata is reused
- [x] Add agent tests

### 4.3 Computer lock/unlock

- [x] Add Windows lock detection
- [x] Add Windows unlock detection
- [x] Close active segment on lock
- [x] Emit COMPUTER_LOCK once per transition
- [x] Emit COMPUTER_UNLOCK once per transition
- [x] Do not count locked duration as active application time
- [x] Queue events offline normally
- [x] Upload through existing batch contract
- [x] Display events in activity timeline
- [x] Add tests

### 4.4 Tray UI

- [x] Add system tray icon
- [x] Show connected/disconnected state
- [x] Show current application
- [x] Show project/task if available
- [x] Show today's active time
- [x] Show today's idle time
- [x] Show agent version
- [x] Add Open WorkLens action
- [x] Add View Today's Activity action if practical
- [x] Avoid new high-frequency API calls
- [ ] Confirm startup behavior

### 4.5 Filtering framework

- [x] Add reusable filter parsing/validation
- [x] Add date filtering
- [x] Add employee filtering
- [x] Add department filtering
- [x] Add project filtering
- [x] Add task filtering where applicable
- [x] Add application filtering
- [x] Add activity-type filtering
- [x] Add status filtering
- [x] Add pagination bounds
- [x] Add relevant filters to Activity
- [x] Add relevant filters to Tasks
- [x] Add relevant filters to Projects
- [x] Add broad filters to Reports
- [x] Preserve filters in URL where practical
- [x] Add tests

### 4.6 Basic notifications

- [x] Add notification bell/panel
- [x] Derive due-soon tasks
- [x] Derive overdue tasks
- [x] Exclude completed/cancelled tasks
- [x] Scope results by role/company
- [x] Add employee-specific notifications where appropriate
- [x] Add empty state
- [x] Add tests

### Day 3 acceptance

- [ ] Agent consumes company settings efficiently
- [ ] Lock/unlock events appear correctly
- [ ] Tray UI works
- [ ] Major screens have practical filters
- [ ] Deadline notifications work

---

## 5. Day 4 — Stabilization, UX Pass, Installer, Deployment

### Goal

No major new features. Make the release reliable and deliverable.

### 5.1 UI/UX regression pass

Review:

- [ ] Dashboard
- [ ] Employees
- [ ] Employee detail
- [ ] Departments
- [ ] Projects
- [ ] Project detail
- [ ] Tasks
- [ ] Task detail
- [ ] Activity
- [ ] Time entries
- [ ] Reports
- [ ] Settings
- [ ] Admin overview
- [ ] Admin companies
- [ ] Admin users
- [ ] Admin system logs
- [ ] Employee dashboard
- [ ] My tasks
- [ ] My projects
- [ ] My time
- [ ] My activity

For each:

- [ ] Loading state
- [ ] Success state
- [ ] Empty state
- [ ] Error state
- [ ] Responsive layout
- [ ] Clear primary action
- [ ] Consistent terminology

### 5.2 Security and authorization regression

- [ ] Employee cannot view another employee's activity
- [ ] Employee cannot manage departments
- [ ] Employee cannot access admin routes
- [ ] Manager cannot access another company
- [ ] Manager cannot access Super Admin routes
- [ ] Super Admin functionality does not bypass unrelated security constraints
- [ ] Tracking settings are company-scoped
- [ ] Device config uses authenticated device context
- [ ] Audit logs do not expose tokens/secrets

### 5.3 Agent regression

- [ ] Startup works
- [ ] Heartbeat works
- [ ] Batch activity upload works
- [ ] Offline queue works
- [ ] Retry does not duplicate events
- [ ] Idle tracking works
- [ ] Dynamic idle threshold works
- [ ] Exclusions work
- [ ] AutoCAD detection works
- [ ] DWG detection works
- [ ] Lock/unlock works
- [ ] Tray works

### 5.4 Installer

- [x] Bump agent version
- [ ] Build installer
- [ ] Verify production API URL
- [ ] Test clean install
- [ ] Test one-time activation/device credentials
- [ ] Test startup-on-login
- [ ] Test reinstall/upgrade
- [ ] Test tray launch
- [ ] Test production heartbeat
- [ ] Test production activity upload

### 5.5 Deployment

- [ ] Apply database migration
- [ ] Verify environment variables
- [ ] Deploy web application
- [ ] Smoke-test production manager account
- [ ] Smoke-test production employee account
- [ ] Smoke-test Super Admin account
- [ ] Smoke-test production agent
- [ ] Verify audit logging
- [ ] Verify tracking settings propagation

### 5.6 Documentation and handoff

- [x] Update README
- [x] Update agent install instructions
- [x] Document Super Admin usage
- [x] Document tracking settings
- [x] Document exclusions/privacy behavior
- [x] Document known limitations
- [ ] Document V2/V3 backlog
- [ ] Update screenshots/demo material if required

### Day 4 acceptance

- [ ] Full test checklist passes
- [ ] Production deployment is usable
- [ ] New installer is verified
- [ ] Release notes/known limitations are accurate

---

## 6. Priority Order If Time Becomes Tight

Do not remove security, tenant isolation, or regression testing to preserve cosmetic work.

Priority:

1. Tracking settings + exclusions
2. Departments
3. Super Admin core companies/users/logs
4. Manual time editing/audit
5. Lock/unlock
6. Filtering
7. Agent tray UI
8. Basic notifications
9. Additional visual polish

## 7. Stop Conditions

Do not begin any V2/V3 feature until:

- All P0 V1 completion items are implemented
- Critical regression tests pass
- Production build is deployable

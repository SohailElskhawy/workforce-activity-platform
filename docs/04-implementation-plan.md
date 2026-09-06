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
- [ ] Implement/standardize AppShell
- [ ] Standardize PageHeader
- [ ] Standardize breadcrumbs
- [ ] Standardize KPI cards
- [ ] Standardize DataTable pattern
- [ ] Standardize FilterBar pattern
- [ ] Standardize status and priority badges
- [ ] Standardize loading skeletons
- [ ] Standardize empty states
- [ ] Standardize error states
- [ ] Standardize form/dialog behavior
- [ ] Standardize toast feedback
- [ ] Verify responsive behavior on main existing routes

### 2.2 Department management

- [ ] Confirm existing Department schema
- [ ] Add/fix department API endpoints
- [ ] Add manager authorization and tenant scoping
- [ ] Add department list page
- [ ] Add create department flow
- [ ] Add edit department flow
- [ ] Add department manager assignment
- [ ] Add department detail/member view
- [ ] Ensure employee forms use department data consistently
- [ ] Add audit events for department mutations
- [ ] Add validation/error/empty states
- [ ] Add tests

### 2.3 Tracking settings

- [ ] Add `CompanyTrackingSettings` model if missing
- [ ] Add `ExcludedApplication` model if using normalized table
- [ ] Add migration
- [ ] Add manager settings API
- [ ] Add tenant authorization
- [ ] Add tracking settings page
- [ ] Add idle-threshold validation
- [ ] Add excluded-app CRUD
- [ ] Increment `configVersion` on relevant setting changes
- [ ] Audit setting changes
- [ ] Add tests

### Day 1 acceptance

- [ ] Departments are fully manageable by a Manager
- [ ] Tracking settings persist correctly
- [ ] Existing UI uses the new shared patterns without critical regressions

---

## 3. Day 2 — Super Admin, Audit, Manual Time Editing

### Goal

Complete remaining web-side V1 administration and audit requirements.

### 3.1 Super Admin shell and authorization

- [ ] Add/verify SUPER_ADMIN authorization helper
- [ ] Create admin route group/layout
- [ ] Ensure manager routes remain company-scoped
- [ ] Add admin overview

### 3.2 Company management

- [ ] Company list
- [ ] Company detail
- [ ] Create company
- [ ] Edit company
- [ ] Activate/deactivate company
- [ ] Company-level summary statistics
- [ ] Validation
- [ ] Audit events
- [ ] Tests

### 3.3 User management

- [ ] User list
- [ ] Create user
- [ ] Edit role
- [ ] Assign company
- [ ] Activate/deactivate user
- [ ] Prevent invalid role/company combinations
- [ ] Audit events
- [ ] Tests

### 3.4 System logs

- [ ] Add Super Admin system-log page
- [ ] Reuse AuditLog source
- [ ] Add filters by date/company/user/action/entity
- [ ] Add readable detail view
- [ ] Avoid exposing secrets/tokens in metadata

### 3.5 Integration management placeholder/status UI

- [ ] Add integrations admin/settings screen
- [ ] List ClickUp
- [ ] List Kolay İK
- [ ] List Clockify
- [ ] Clearly label as not configured/future integration where applicable
- [ ] Do not implement synchronization

### 3.6 Manual time editing

- [ ] Add edit action to eligible manual entries
- [ ] Add PATCH endpoint if missing
- [ ] Validate ownership/authorization
- [ ] Recalculate duration server-side
- [ ] Reject future values
- [ ] Reject invalid overlaps
- [ ] Validate project/task relationship
- [ ] Add optional reason
- [ ] Write before/after audit metadata
- [ ] Update UI after edit
- [ ] Add tests

### 3.7 Audit pass

- [ ] Review all required V1 mutations
- [ ] Add missing audit events
- [ ] Confirm tenant/company metadata
- [ ] Confirm sensitive values are not stored

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

- [ ] Extend heartbeat response with `configVersion`
- [ ] Add authenticated agent-config endpoint
- [ ] Add local cached config
- [ ] Fetch config only when version changes
- [ ] Apply idle threshold dynamically
- [ ] Apply excluded process list dynamically
- [ ] Ensure malformed config does not crash agent
- [ ] Add tests

### 4.2 Excluded applications

- [ ] Normalize process names
- [ ] Ensure excluded apps do not expose titles/files
- [ ] Ensure changes apply after config refresh
- [ ] Verify no stale sensitive metadata is reused
- [ ] Add agent tests

### 4.3 Computer lock/unlock

- [ ] Add Windows lock detection
- [ ] Add Windows unlock detection
- [ ] Close active segment on lock
- [ ] Emit COMPUTER_LOCK once per transition
- [ ] Emit COMPUTER_UNLOCK once per transition
- [ ] Do not count locked duration as active application time
- [ ] Queue events offline normally
- [ ] Upload through existing batch contract
- [ ] Display events in activity timeline
- [ ] Add tests

### 4.4 Tray UI

- [ ] Add system tray icon
- [ ] Show connected/disconnected state
- [ ] Show current application
- [ ] Show project/task if available
- [ ] Show today's active time
- [ ] Show today's idle time
- [ ] Show agent version
- [ ] Add Open WorkLens action
- [ ] Add View Today's Activity action if practical
- [ ] Avoid new high-frequency API calls
- [ ] Confirm startup behavior

### 4.5 Filtering framework

- [ ] Add reusable filter parsing/validation
- [ ] Add date filtering
- [ ] Add employee filtering
- [ ] Add department filtering
- [ ] Add project filtering
- [ ] Add task filtering where applicable
- [ ] Add application filtering
- [ ] Add activity-type filtering
- [ ] Add status filtering
- [ ] Add pagination bounds
- [ ] Add relevant filters to Activity
- [ ] Add relevant filters to Tasks
- [ ] Add relevant filters to Projects
- [ ] Add broad filters to Reports
- [ ] Preserve filters in URL where practical
- [ ] Add tests

### 4.6 Basic notifications

- [ ] Add notification bell/panel
- [ ] Derive due-soon tasks
- [ ] Derive overdue tasks
- [ ] Exclude completed/cancelled tasks
- [ ] Scope results by role/company
- [ ] Add employee-specific notifications where appropriate
- [ ] Add empty state
- [ ] Add tests

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

- [ ] Bump agent version
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

- [ ] Update README
- [ ] Update agent install instructions
- [ ] Document Super Admin usage
- [ ] Document tracking settings
- [ ] Document exclusions/privacy behavior
- [ ] Document known limitations
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

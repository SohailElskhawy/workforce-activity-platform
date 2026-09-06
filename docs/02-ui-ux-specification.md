# UI/UX Specification — V1 Completion Release

## 1. Objective

Make the application easier to understand and operate without introducing decorative complexity.

The interface should behave like a clear B2B SaaS management system: predictable navigation, consistent page structures, low cognitive load, and explicit data semantics.

## 2. Navigation Architecture

### 2.1 Manager

```text
Dashboard

Workforce
  Employees
  Departments
  Devices

Work
  Projects
  Tasks

Tracking
  Activity
  Time Entries

Analytics
  Reports

Administration
  Settings
  Integrations
```

### 2.2 Employee

```text
My Dashboard
My Tasks
My Projects
My Time
My Activity
```

### 2.3 Super Admin

```text
Overview
Companies
Users
System Logs
Integrations
System Settings
```

## 3. Shared App Shell

All authenticated routes should use a shared shell containing:

- Left navigation sidebar
- Compact top header
- Current page title
- User/account menu
- Notification bell where applicable
- Responsive mobile/tablet behavior

## 4. Standard Page Structure

Use this order whenever applicable:

```text
Page title                              Primary Action
Description / optional breadcrumbs

Summary / KPIs

Filters

Main content

Secondary detail / contextual actions
```

## 5. Shared Components

Create or standardize reusable components for:

- PageHeader
- Breadcrumbs
- KPI cards
- Status badge
- Priority badge
- Data table
- Filter bar
- Search input
- Date-range filter
- Pagination
- Empty state
- Error state
- Loading skeleton
- Confirmation dialog
- Form dialog/sheet
- Toast feedback
- Section header
- Activity timeline row
- Key/value detail group

## 6. Table Behavior

Tables should:

- Keep the most important identifier in the first column
- Avoid excessive columns
- Use concise badges for status/priority
- Keep row actions in a consistent action menu
- Preserve filters in URL query parameters where practical
- Provide empty and error states
- Use pagination for large datasets

## 7. Filter Behavior

Filters should be contextual rather than showing every possible filter on every screen.

### Activity

- Date
- Employee
- Department
- Project
- Application
- Activity type

### Tasks

- Employee
- Department
- Project
- Status
- Priority
- Deadline state

### Projects

- Status
- Department where relevant
- Employee where relevant
- Date

### Reports

Use the broadest supported set:

- Date
- Employee
- Department
- Project
- Task
- Application
- Activity type
- Status

## 8. Manager Experience

### Dashboard

Prioritize:

- Employee totals
- Active/offline agent state
- Active time
- Idle time
- Completed tasks
- Overdue tasks
- Recent activity
- Projects at risk of overrunning estimates where already derivable without anomaly logic

### Employee Detail

Show:

- Identity
- Department
- Position/status
- Device/agent status
- Active time
- Idle time
- Manual time
- Application breakdown
- Timeline
- Assigned tasks
- AutoCAD/DWG details where available

### Project Detail

Show:

- Project metadata
- Estimated time
- Tracked project activity
- Manual time separately
- Task list
- Employee involvement
- Relevant DWG mappings

## 9. Employee Experience

The employee-facing UI must emphasize transparency.

### My Dashboard

Show:

- Today's active time
- Today's idle time
- Today's manual time
- Current/next tasks
- Recent activity

### My Activity

Clearly distinguish:

```text
Application activity
Idle time
System events
Project/task mapping
```

The employee should be able to understand what the agent recorded.

## 10. Department Management UI

### Route

```text
/departments
/departments/:id
```

### List screen

Columns:

- Department name
- Manager
- Employee count
- Updated date
- Actions

### Department detail

Show:

- Department name
- Department manager
- Member employees
- Relevant employee status summary

Actions:

- Edit department
- Change manager
- Add/move employees through employee management flows

## 11. Tracking Settings UI

### Route

```text
/settings/tracking
```

Sections:

### Idle Detection

```text
Idle threshold: [ 5 ] minutes
```

Include concise explanatory text that idle time is not counted as active application time.

### Excluded Applications

Allow adding/removing process/application entries.

Example:

```text
WhatsApp.exe
1Password.exe
PersonalBrowser.exe
```

Explain that excluded applications are not intended to expose sensitive activity details.

## 12. Super Admin UX

### Companies

List:

- Company
- Status
- User count
- Employee count
- Project count
- Device count
- Created date

Actions:

- Create
- Edit
- Activate/deactivate
- Open company detail

### Users

List:

- Name/email
- Role
- Company
- Status
- Last relevant activity where available

Actions:

- Create
- Edit role
- Activate/deactivate

### System Logs

Filters:

- Date
- Company
- User
- Action
- Entity type

Show readable metadata rather than raw JSON where practical.

## 13. Agent Tray UX

Tray panel/menu should show:

```text
WorkLens

● Connected

Current Application
AutoCAD

Project
ABC AVM

Task
A Block Electrical Drawing

Today
Active: 5h 42m
Idle:   38m

Agent Version
1.x.x
```

Actions:

- Open WorkLens
- View today's activity
- Show connection status
- Exit application only if required for normal desktop behavior

Do not add a tracking pause feature in this release.

## 14. Notifications UX

Use a simple notification bell and panel.

Supported notification types:

- Deadline approaching
- Task overdue

Example:

```text
Deadline approaching
B Block Drawing
Due tomorrow
```

```text
Task overdue
Revision Work
2 days overdue
```

Notifications must not require WebSockets for this release.

## 15. Accessibility and Usability

- All forms require visible labels
- Keyboard focus must be usable
- Avoid color-only status communication
- Dates/times use one consistent display format
- Buttons use action verbs
- Destructive actions require confirmation
- Validation errors appear near relevant fields
- Avoid hidden critical actions
- Keep text concise and operational

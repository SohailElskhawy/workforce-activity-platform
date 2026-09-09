# WorkLens Light Design System & UI Migration

## Purpose

Adopt the supplied reference's clear, light, blue-forward B2B SaaS visual
language throughout the existing WorkLens web application. The outcome is a
readable, consistent interface for manager, employee, and super-admin users;
it is not a rewrite of product behavior, permissions, APIs, or tracking.

## Scope and constraints

- Apply the system to all authenticated WorkLens web surfaces and the login
  experience where shared visual primitives apply.
- Preserve existing manager, employee, and super-admin navigation boundaries,
  authorization, tenant isolation, validation, audit logging, and API
  contracts.
- Preserve application information architecture defined in
  `docs/02-ui-ux-specification.md`.
- Use the existing Next.js, Tailwind v4, shadcn-style component stack, Lucide
  icons, and Recharts. Do not add a UI-library dependency.
- Do not copy e-commerce-specific reference content such as upgrade prompts,
  orders/products vocabulary, or a generic AI chat widget.

## Visual language

### Typography

Use Inter as the sole UI font, loaded by Next.js and exposed through the
existing `--font-worklens-sans` token. It applies to headings, controls,
tables, metrics, and body copy. Use clear hierarchy rather than extreme font
weights:

| Purpose | Size / weight |
| --- | --- |
| Page title | 24-30px / 600 |
| Section title | 16-18px / 600 |
| KPI value | 24-30px / 600 |
| Controls and table body | 14px / 400-500 |
| Metadata and helper text | 12-13px / 400-500 |

Headings use deep slate, normal text uses slate, and supporting text uses a
lighter slate. Near-black and dark-background styling must not be used as a
default visual treatment.

### Tokens

The application canvas is a pale cool gray; cards, sidebar, header, popovers,
and dialogs are white. Primary actions, selected navigation, focused controls,
and main chart series use accessible blue (the existing implementation should
select exact token values with AA contrast). Borders are subtle cool gray,
cards have light elevation, and standard surface radius is 10-14px.

Semantic colors are reserved for meaningful states:

- green: positive trend, connected, completed, healthy;
- amber: pending, approaching deadline, attention required;
- red: overdue, disconnected, destructive, negative trend;
- blue: primary action, selected/current state, neutral emphasis.

Every semantic color is paired with a visible label and, where useful, an icon;
color is never the only meaning carrier.

## Application shell

Authenticated pages retain the current role-specific route groups but use a
shared light shell:

- a fixed desktop sidebar with grouped navigation and a soft-blue selected
  item;
- a compact white top bar for page context, search where applicable,
  notifications, language, and account controls;
- a responsive navigation sheet on small screens;
- a soft-gray main canvas with predictable page padding and white content
  surfaces.

The shell must retain the current menu visibility rules per role. It must not
surface management links to employees or super-admin links to tenant users.

## Shared component system

Restyle, without breaking public props, the existing primitives: Button,
Card, Input, Select, Badge, DataTable, FilterBar, tabs, dialogs/sheets,
confirmation dialogs, toast feedback, skeletons, and empty/error states.

`PageHeader` becomes the standard entry point for title, description,
breadcrumbs, filters/actions, and responsive action wrapping. KPI cards become
compact summary surfaces with a metric, a concise supporting detail or trend,
and an optional semantic icon. Tables keep the existing pagination, URL-backed
filters, explicit action menus, and loading/empty/error behavior.

## Page composition

Applicable manager and administrator pages consistently use:

1. title, description, and primary action;
2. concise KPI or status summary;
3. contextual search and filters;
4. primary table, timeline, or dashboard content;
5. secondary detail and contextual actions via existing dialogs or sheets.

Avoid adding empty KPI rows to simple maintenance forms where they provide no
operational value.

### Manager dashboard

The manager dashboard adopts the reference's modular bento layout using only
stored WorkLens data:

- header with compact date range, report export, and appropriate primary
  action;
- four top metrics: employees online, active tracked time, idle time, and
  overdue/open tasks;
- activity trend and workforce/device state as primary modules;
- recent activity and project/task risk as operational modules;
- application mix, department workload, and deadline notifications as
  secondary modules;
- an insight card only for factual deterministic insights or clearly-labeled,
  stored-data-grounded intelligence already supported by the product.

No productivity score is invented from visual data alone. Manual time remains
visually and semantically distinct from automated activity.

### Employee workspace

Use the same visual language while favoring transparency. My Dashboard shows
today's active, idle, and manual time, current tasks/projects, and recent
activity. My Activity continues to distinguish application activity, idle
time, lock/unlock and other system events, and project/task mapping.

### Super Admin workspace

Companies, users, system logs, integrations, and system settings use the same
dashboard/table/filter patterns while preserving cross-company authority only
for super-admin routes. System logs favor readable, structured metadata rather
than raw JSON.

## Delivery sequence

1. Define global Inter/font loading and light design tokens.
2. Restyle shared UI primitives and the layout shell.
3. Migrate the manager dashboard and common page header/KPI/filter patterns.
4. Migrate manager workforce, work, tracking, analytics, and settings pages.
5. Migrate employee and super-admin pages using the shared components.
6. Complete responsive, accessibility, localization, and visual regression
   passes.

This foundation-first sequence prevents one-off page styling and allows each
screen migration to preserve behavior.

## Error handling and accessibility

Existing validation, error, empty, loading, confirmation, and toast mechanisms
remain in use. Restyling must retain visible labels, keyboard focus, readable
error placement, action-oriented buttons, safe destructive confirmations, and
long Turkish/English label handling. Charts must include text summaries or
accessible labels sufficient to understand key values without color alone.

## Verification

For each migrated surface:

- run focused component/page tests plus the current UI foundation tests;
- run lint, type/build checks, and the full web test suite before completion;
- verify manager, employee, and super-admin route visibility and access;
- confirm tenant-isolated data remains unchanged;
- check desktop, tablet, and mobile layouts; keyboard flow; contrast; and
  loading, empty, error, success, and long-localized-text states.

No backend mutation or schema work is required unless a discovered visual
defect exposes an existing UI contract gap; such a change requires separate
scope confirmation.

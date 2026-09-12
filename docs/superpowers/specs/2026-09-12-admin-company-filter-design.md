# Super Admin Company Filter Redesign Specification

- **Date**: 2026-09-12
- **Status**: Approved
- **Scope**: Super Admin Filter Bars (`/admin/users`, `/admin/system-logs`)

---

## 1. Overview & Problem Statement

### 1.1 Problem
In the Super Admin screens (`/admin/users` and `/admin/system-logs`), filtering by company is currently implemented using an HTML `<details>` disclosure element containing the heavy `CompanyPicker` component. 

This causes major UX and visual defects:
1. **Broken Layout**: `<FilterBar>` is designed as a single-row flex toolbar with height `h-9` controls. Expanding `<details className="w-full sm:w-96">` vertically inflates the toolbar and wraps sister controls awkwardly across lines.
2. **Heavy Nested Card**: Opening the disclosure reveals an embedded border card (`space-y-2 rounded-lg border p-3`) with its own search field, help text, native `<select>`, total count, and full `<TablePagination />` buttons (`< 1 2 3 >`) inside the filter bar.
3. **Cryptic Identification**: The summary text only displays the first 8 characters of the company UUID (`{filters.companyId.slice(0, 8)}`) rather than the actual company name.

### 1.2 Objective
Replace the inline `<details><CompanyPicker /></details>` inside filter bars with a clean, lightweight, searchable **Combobox / Popover** component (`CompanyFilter`). The new component will match the standard `FilterSelect` / `FilterBar` height and design language, display full company names, provide real-time search, and keep the toolbar inline and visually balanced.

---

## 2. Component Architecture & Boundaries

### 2.1 File Structure
- **New Component**: `web/components/admin/company-filter.tsx`
  - Encapsulates trigger button, floating popover, search input, company list, selection state, and debounced API queries.
- **Updated Consumer**: `web/components/admin/admin-ui.tsx`
  - In `AdminUsers`: Replace `<details><CompanyPicker /></details>` with `<CompanyFilter />`.
  - In `AdminLogs`: Replace `<details><CompanyPicker /></details>` with `<CompanyFilter />`.
- **Preserved Existing**:
  - `CompanyPicker` in `admin-ui.tsx` remains strictly for full dialog forms (`UserForm` and `ConfigureIntegrationDialog`) where a dedicated form field card is desired.

### 2.2 Component Interface
```typescript
export interface CompanyFilterProps {
  value: string; // Active company ID or "" for all companies
  onChange: (companyId: string, companyName: string) => void;
  className?: string;
  disabled?: boolean;
}
```

---

## 3. UI/UX & Interaction Design

### 3.1 Inline Trigger (In FilterBar)
- **Dimensions**: Fixed height `h-9`, min-width `min-w-[190px]`, max-width `max-w-[260px]`.
- **Styling**: `flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent/50 transition-colors shadow-xs`.
- **Left Icon**: `Building2` (`size-4 text-muted-foreground shrink-0`).
- **Label**:
  - When `value === ""`: Shows `"All Companies"` (`t.admin.allCompanies` / localized).
  - When `value` is set: Shows the resolved human-readable company name (truncated with ellipsis if long).
- **Right Action**:
  - When `value` is set: A quick-clear `X` button (`size-3.5 text-muted-foreground hover:text-foreground`) to reset selection to `""` in 1 click without opening the popover.
  - When `value === ""`: Standard `ChevronDown` icon (`size-4 text-muted-foreground shrink-0`).

### 3.2 Floating Popover Dropdown
- **Positioning**: Absolute dropdown anchored below the trigger (`top-full left-0 mt-1.5 z-50 w-[280px] sm:w-[320px]`).
- **Styling**: `rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-1.5 space-y-1`.
- **Search Header**:
  - Integrated search input with `Search` icon.
  - Automatically receives focus upon dropdown open.
  - Placeholder: `"Search companies..."` (`t.common.search`).
  - Clear button if text is entered.
- **Option List**:
  - Scrollable container: `max-h-60 overflow-y-auto space-y-0.5`.
  - **"All Companies" Item**: Topmost static option. Shows `Building2` icon and checkmark if currently selected. Clicking selects `""` and closes dropdown.
  - **Company Items**:
    - Each item renders a `Check` icon (visible when active, transparent space when inactive), company name (`font-medium truncate`), and short ID snippet (`text-xs text-muted-foreground font-mono`).
    - Hover highlight: `hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer px-2 py-1.5 text-sm`.
- **Dismissal**:
  - Clicking outside closes the popover.
  - Pressing <kbd>Escape</kbd> closes the popover and returns focus to the trigger.
  - Selecting an item immediately fires `onChange` and closes the popover.

---

## 4. Data Flow, API & State Management

### 4.1 Company Data Fetching
1. **Initial Request**:
   - On initial mount or dropdown open, fetch `/api/admin/companies?pageSize=100&page=1`.
   - Populates the initial selectable list and populates an internal name lookup cache.
2. **Live Search**:
   - As the user types in the popover search input, debounce requests by 200ms.
   - Query `/api/admin/companies?q=${encodeURIComponent(query)}&pageSize=50`.
3. **Selected Name Cache**:
   - Maintain a local map/cache of `{ [id: string]: string }` (id to name).
   - If a `value` prop is passed on load (e.g. from a URL parameter), ensure the company name is resolved from cache or fetched so the trigger displays the real company name immediately instead of an ID.

### 4.2 Error & Empty States
- **Loading**: Render a subtle loading spinner or skeleton inside the popover list without obstructing the search input.
- **Empty State**: Render `"No companies found"` (`t.common.noResults` or localized) when query yields 0 results.
- **Network Error**: Display a compact inline error message with a `"Retry"` button inside the popover menu; do not throw or disrupt the rest of the page.

---

## 5. Integration Points

### 5.1 `AdminUsers` (`web/components/admin/admin-ui.tsx`)
Replace:
```tsx
<details className="w-full sm:w-96">
  <summary className="cursor-pointer text-sm">
    {t.admin.filterCompany}
    {filters.companyId ? ` · ${filters.companyId.slice(0, 8)}` : ""}
  </summary>
  <CompanyPicker
    optional
    value={filters.companyId}
    onChange={(id) => filter("companyId", id)}
  />
</details>
```
With:
```tsx
<CompanyFilter
  value={filters.companyId}
  onChange={(id) => filter("companyId", id)}
/>
```

### 5.2 `AdminLogs` (`web/components/admin/admin-ui.tsx`)
Apply the exact same replacement to ensure consistency across all Super Admin filter bars.

---

## 6. Testing & Acceptance Criteria

### 6.1 Automated Tests
- Create `web/lib/admin-company-filter.test.ts` to test:
  1. Trigger renders with `"All Companies"` by default.
  2. Popover toggle open/close behavior and <kbd>Escape</kbd> dismissal.
  3. Search query filtering behavior.
  4. Option selection triggering `onChange(id, name)` and auto-closing popover.
  5. Quick-clear `(X)` button invoking `onChange("", "")`.
- Run full test suite: `npm test` passing with 0 failures.
- Run typecheck: `npx tsc --noEmit` clean with 0 errors.

### 6.2 Visual & Acceptance Criteria
- [x] Filter bar in `/admin/users` does not break layout or wrap awkwardly on standard screens.
- [x] Trigger button matches height (`h-9`), borders, and styling of adjacent filter controls.
- [x] Selected company displays full company name, not a sliced UUID.
- [x] Popover opens below trigger with zero interference with table data.
- [x] Search input inside popover filters companies accurately and smoothly.
- [x] Clearing filters resets the company filter cleanly.
- [x] System logs screen (`/admin/system-logs`) reflects the same clean behavior.
- [x] Existing `UserForm` modal and integration dialogs remain functional.

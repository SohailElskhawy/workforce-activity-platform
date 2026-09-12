# Super Admin Company Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the layout-breaking `<details><CompanyPicker /></details>` in Super Admin filter bars (`/admin/users` and `/admin/system-logs`) with a clean, searchable popover combobox (`CompanyFilter`).

**Architecture:** Create an isolated, accessible `CompanyFilter` client component matching the existing `FilterBar` control styling (`h-9`, border, hover effects). The component mounts an inline trigger displaying the selected company name or "All Companies" and an attached popover dropdown with live debounced search querying `/api/admin/companies`. Then swap out the disclosure wrappers in `AdminUsers` and `AdminLogs` in `admin-ui.tsx`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Lucide React (`Building2`, `ChevronDown`, `Check`, `Search`, `X`), node:test.

**Spec:** `docs/superpowers/specs/2026-09-12-admin-company-filter-design.md`

## Global Constraints

- Never break or expand the single-row layout of `FilterBar`.
- Trigger height must match sister controls (`h-9`).
- Selected company must display full company name, not a sliced UUID.
- Retain existing `CompanyPicker` definition for modal dialogs (`UserForm` and `ConfigureIntegrationDialog`).
- Support keyboard dismissal (<kbd>Escape</kbd>) and click-outside closing.
- Use existing i18n dictionaries (`t.admin.allCompanies`, `t.admin.filterCompany`, `t.common.search`, `t.common.noResults`, `t.common.retry`, `t.common.loading`).

---

### Task 1: Create the Reusable `CompanyFilter` Popover Combobox

**Files:**
- Create: `web/components/admin/company-filter.tsx`
- Create: `web/lib/admin-company-filter.test.ts`

**Interfaces:**
- Produces `CompanyFilterProps` and `CompanyFilter`:
```typescript
export interface CompanyFilterProps {
  value: string;
  onChange: (companyId: string, companyName: string) => void;
  className?: string;
  disabled?: boolean;
}
```

- [ ] **Step 1: Write the failing unit and markup tests**

Create `web/lib/admin-company-filter.test.ts`:
```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanyFilter } from "@/components/admin/company-filter";

test("CompanyFilter renders trigger with default All Companies state", () => {
  const markup = renderToStaticMarkup(
    createElement(CompanyFilter, {
      value: "",
      onChange: () => undefined,
    }),
  );

  // Trigger button should be rendered with combobox role and All Companies label
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /Tüm şirketler|All companies/);
  // Should not render clear button when empty
  assert.doesNotMatch(markup, /aria-label="Clear company filter"/);
});

test("CompanyFilter renders trigger with selected company name and quick-clear button", () => {
  const markup = renderToStaticMarkup(
    createElement(CompanyFilter, {
      value: "c1111111-1111-1111-1111-111111111111",
      initialName: "Acme Architecture",
      onChange: () => undefined,
    }),
  );

  assert.match(markup, /Acme Architecture/);
  assert.match(markup, /aria-label="Clear company filter"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- lib/admin-company-filter.test.ts
```
Expected: FAIL because `CompanyFilter` does not exist yet.

- [ ] **Step 3: Implement `CompanyFilter` component**

Create `web/components/admin/company-filter.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CompanyFilterProps {
  value: string;
  initialName?: string;
  onChange: (companyId: string, companyName: string) => void;
  className?: string;
  disabled?: boolean;
}

interface CompanyItem {
  id: string;
  name: string;
}

export function CompanyFilter({
  value,
  initialName = "",
  onChange,
  className = "",
  disabled = false,
}: CompanyFilterProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local cache for company id -> name resolution
  const [companyNames, setCompanyNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (value && initialName) {
      initial[value] = initialName;
    }
    return initial;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  // Fetch companies on mount or search
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: "1",
          pageSize: query.trim() ? "50" : "100",
        });
        if (query.trim()) {
          params.set("q", query.trim());
        }

        fetch(`/api/admin/companies?${params.toString()}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to load companies");
            return res.json();
          })
          .then((data: { items: CompanyItem[] }) => {
            if (!active) return;
            setCompanies(data.items ?? []);
            setCompanyNames((prev) => {
              const next = { ...prev };
              for (const c of data.items ?? []) {
                next[c.id] = c.name;
              }
              return next;
            });
            setLoading(false);
          })
          .catch((err) => {
            if (!active) return;
            setError(err.message || "Failed to load");
            setLoading(false);
          });
      },
      query.trim() ? 200 : 0,
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const selectedName =
    value && companyNames[value]
      ? companyNames[value]
      : value
        ? `${value.slice(0, 8)}...`
        : "";

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger Button */}
      <div className="flex items-center">
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t.admin.filterCompany}
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex h-9 min-w-[190px] max-w-[260px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
            "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring outline-none",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? selectedName : t.admin.allCompanies}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear company filter"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("", "");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange("", "");
                  }
                }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </div>

      {/* Floating Popover */}
      {open && (
        <div
          role="listbox"
          aria-label={t.admin.filterCompany}
          className="absolute left-0 top-full z-50 mt-1.5 w-[280px] sm:w-[320px] rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {/* Search Header */}
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.common.search}
              className="h-8 pl-8 pr-7 text-xs"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {/* "All Companies" Option */}
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange("", "");
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                !value
                  ? "bg-accent font-medium text-accent-foreground"
                  : "hover:bg-accent/50 text-foreground",
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.admin.allCompanies}</span>
              </div>
              {!value && <Check className="size-3.5 text-primary shrink-0" />}
            </button>

            {/* Separator */}
            <div className="my-1 border-t border-border/50" />

            {/* Loading State */}
            {loading && companies.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t.common.loading}</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-2 text-center text-xs text-destructive space-y-1">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setQuery((q) => q + " ")}
                  className="underline hover:text-destructive/80 font-medium"
                >
                  {t.common.retry}
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && companies.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {t.common.noResults}
              </div>
            )}

            {/* Company Items */}
            {companies.map((c) => {
              const isSelected = value === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setCompanyNames((prev) => ({ ...prev, [c.id]: c.name }));
                    onChange(c.id, c.name);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-accent/50 text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      · {c.id.slice(0, 8)}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- lib/admin-company-filter.test.ts
```
Expected: PASS (2 tests pass).

- [ ] **Step 5: Commit component and tests**

```bash
git add web/components/admin/company-filter.tsx web/lib/admin-company-filter.test.ts
git commit -m "feat(admin): add reusable CompanyFilter popover combobox"
```

---

### Task 2: Replace `<details><CompanyPicker /></details>` in `AdminUsers` and `AdminLogs`

**Files:**
- Modify: `web/components/admin/admin-ui.tsx`
- Modify: `web/lib/admin-company-filter.test.ts`

**Interfaces:**
- Consumes `CompanyFilter` from `@/components/admin/company-filter`
- Updates `AdminUsers` FilterBar (line ~572) and `AdminLogs` FilterBar (line ~701)

- [ ] **Step 1: Add integration tests for Super Admin filter bars**

Add to `web/lib/admin-company-filter.test.ts`:
```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("admin-ui.tsx imports CompanyFilter and does not contain details disclosure filter wrappers", () => {
  const adminUiSource = readFileSync(
    join(process.cwd(), "components/admin/admin-ui.tsx"),
    "utf8",
  );

  // Check import
  assert.match(
    adminUiSource,
    /import\s+\{\s*CompanyFilter\s*\}\s+from\s+["']\.\/company-filter["']/,
  );

  // Check usage of CompanyFilter in AdminUsers and AdminLogs
  const matches = adminUiSource.match(/<CompanyFilter/g);
  assert.equal(matches?.length, 2);

  // Ensure details wrapper inside filter bars is gone
  assert.doesNotMatch(adminUiSource, /<details[^>]*sm:w-96/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npm test -- lib/admin-company-filter.test.ts
```
Expected: FAIL because `admin-ui.tsx` still has `<details>` and hasn't imported `CompanyFilter`.

- [ ] **Step 3: Update `admin-ui.tsx`**

1. Add import near top of `web/components/admin/admin-ui.tsx`:
```tsx
import { CompanyFilter } from "./company-filter";
```

2. In `AdminUsers` (~line 572), replace:
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

3. In `AdminLogs` (~line 701), replace:
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

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- lib/admin-company-filter.test.ts
```
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Commit `admin-ui.tsx` changes**

```bash
git add web/components/admin/admin-ui.tsx web/lib/admin-company-filter.test.ts
git commit -m "feat(admin): replace details company picker with CompanyFilter in users and logs"
```

---

### Task 3: Full Verification & Typecheck

**Files:**
- None (verification across entire repo)

- [ ] **Step 1: Run TypeScript typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS with 0 errors.

- [ ] **Step 2: Run all tests in the repository**

Run:
```bash
npm test
```
Expected: PASS (all 226+ tests passing).

- [ ] **Step 3: Verify clean git status**

Run:
```bash
git status
```
Expected: Clean working tree on branch `main`.

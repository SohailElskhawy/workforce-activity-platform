import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, TablePagination } from "@/components/ui/data-table";
import {
  FilterBar,
  FilterReset,
  FilterSearch,
  FilterSelect,
} from "@/components/ui/filter-bar";
import { FormAlert, FormField } from "@/components/ui/form-dialog";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
function renderWithI18n(element: React.ReactElement) {
  return renderToStaticMarkup(element);
}

test("Breadcrumbs renders accessible navigation list", () => {
  const markup = renderWithI18n(
    createElement(Breadcrumbs, {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings" },
      ],
    }),
  );
  assert.match(markup, /aria-label="Breadcrumb"/);
  assert.match(markup, /Settings/);
});

test("PageHeader renders title, description, badge, and breadcrumbs", () => {
  const markup = renderWithI18n(
    createElement(PageHeader, {
      title: "Projects Overview",
      description: "Manage portfolio projects",
      badge: createElement("span", null, "Active"),
      breadcrumbs: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Projects" },
      ],
    }),
  );

  assert.match(markup, /Projects Overview/);
  assert.match(markup, /Manage portfolio projects/);
  assert.match(markup, /Active/);
  assert.match(markup, /aria-label="Breadcrumb"/);
  assert.match(markup, /aria-current="page"/);
  assert.match(markup, /href="\/dashboard"/);
});

test("KpiCard and KpiGrid render metrics with semantic tones and icons", () => {
  const markup = renderWithI18n(
    createElement(
      KpiGrid,
      null,
      createElement(KpiCard, {
        label: "Active Projects",
        value: 12,
        description: "3 overdue",
        tone: "emerald",
      }),
    ),
  );

  assert.match(markup, /Active Projects/);
  assert.match(markup, /12/);
  assert.match(markup, /3 overdue/);
  assert.match(markup, /grid/);
});

test("StatusBadge and PriorityBadge render accessible badges with indicators", () => {
  const statusMarkup = renderWithI18n(
    createElement(StatusBadge, { value: "ACTIVE" }),
  );
  const priorityMarkup = renderWithI18n(
    createElement(PriorityBadge, { value: "URGENT" }),
  );

  assert.match(statusMarkup, /Active/);
  assert.match(statusMarkup, /aria-hidden="true"/);
  assert.match(priorityMarkup, /Urgent/);
});

test("DataTable and TablePagination render tabular data and pagination correctly", () => {
  type Row = { id: string; name: string };
  const data: Row[] = [
    { id: "1", name: "Alpha Project" },
    { id: "2", name: "Beta Project" },
  ];

  const markup = renderWithI18n(
    createElement(DataTable<Row>, {
      columns: [{ header: "Name", accessorKey: "name" }],
      data,
      pagination: {
        page: 1,
        pageSize: 10,
        total: 2,
        onPageChange: () => undefined,
      },
    }),
  );

  assert.match(markup, /Alpha Project/);
  assert.match(markup, /Beta Project/);
  assert.match(markup, /Showing/);
  assert.match(markup, /of/);
});

test("TablePagination renders pagination controls standalone", () => {
  const markup = renderWithI18n(
    createElement(TablePagination, {
      page: 2,
      pageSize: 10,
      total: 50,
      onPageChange: () => undefined,
    }),
  );

  assert.match(markup, /Showing/);
  assert.match(markup, /11/);
  assert.match(markup, /20/);
  assert.match(markup, /50/);
});

test("FilterBar and FilterSearch render search with accessible controls", () => {
  const markup = renderWithI18n(
    createElement(
      FilterBar,
      null,
      createElement(FilterSearch, {
        value: "drawing.dwg",
        onChange: () => undefined,
        placeholder: "Search drawings...",
      }),
      createElement(FilterReset, {
        onReset: () => undefined,
      }),
    ),
  );

  assert.match(markup, /role="search"/);
  assert.match(markup, /drawing\.dwg/);
  assert.match(markup, /Clear filters/);
});

test("FilterSelect renders the selected option label instead of its stored value", () => {
  const markup = renderWithI18n(
    createElement(FilterSelect, {
      ariaLabel: "Project",
      onValueChange: () => undefined,
      options: [
        { value: "project_8b0f", label: "ARC-101 — North Tower" },
      ],
      value: "project_8b0f",
    }),
  );

  assert.match(markup, /ARC-101 — North Tower/);
  assert.doesNotMatch(markup, />project_8b0f</);
});

test("Form helpers render accessible labels and alerts", () => {
  const fieldMarkup = renderWithI18n(
    createElement(
      FormField,
      { label: "Department Name", required: true, error: "Name is required" },
      createElement("input", { id: "dept-name" }),
    ),
  );
  const alertMarkup = renderWithI18n(
    createElement(FormAlert, { message: "Failed to save department" }),
  );

  assert.match(fieldMarkup, /Department Name/);
  assert.match(fieldMarkup, /\*/);
  assert.match(fieldMarkup, /Name is required/);
  assert.match(alertMarkup, /role="alert"/);
  assert.match(alertMarkup, /Failed to save department/);
});

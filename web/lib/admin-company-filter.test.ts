import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

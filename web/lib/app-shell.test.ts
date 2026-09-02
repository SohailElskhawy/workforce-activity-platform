import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShell } from "@/components/layout/app-shell";

test("manager shell exposes the complete workspace navigation and logout", () => {
  const markup = renderToStaticMarkup(
    createElement(
      AppShell,
      { email: "manager@worklens.demo", role: "MANAGER" },
      createElement("p", null, "Manager content"),
    ),
  );

  assert.match(markup, /aria-label="Manager navigation"/);
  assert.match(markup, /href="\/dashboard"/);
  assert.match(markup, /href="\/projects"/);
  assert.match(markup, /href="\/tasks"/);
  assert.match(markup, /href="\/employees"/);
  assert.match(markup, /href="\/activities"/);
  assert.match(markup, /href="\/reports"/);
  assert.match(markup, /manager@worklens\.demo/);
  assert.match(markup, /Logout/);
  assert.match(markup, /Manager content/);
});

test("employee shell exposes only the employee self-service workspace", () => {
  const markup = renderToStaticMarkup(
    createElement(
      AppShell,
      { email: "employee@worklens.demo", role: "EMPLOYEE" },
      createElement("p", null, "Employee content"),
    ),
  );

  assert.match(markup, /aria-label="Employee navigation"/);
  assert.match(markup, /href="\/my-dashboard"/);
  assert.match(markup, /href="\/my-projects"/);
  assert.match(markup, /href="\/my-tasks"/);
  assert.match(markup, /href="\/my-time"/);
  assert.match(markup, /href="\/my-activity"/);
  assert.doesNotMatch(markup, /href="\/employees"/);
  assert.match(markup, /Logout/);
});

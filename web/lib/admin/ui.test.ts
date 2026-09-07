import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  AdminCompanies,
  AdminUsers,
  AdminLogs,
  AdminOverview,
  AdminInformation,
} from "@/components/admin/admin-ui";
import { en } from "@/lib/i18n/dictionaries/en";
import { tr } from "@/lib/i18n/dictionaries/tr";
import { getRoleHomeRoute } from "@/lib/auth-routes";

test("admin navigation is separate and invisible to manager and employee shells", () => {
  for (const role of ["SUPER_ADMIN", "MANAGER", "EMPLOYEE"] as const) {
    const markup = renderToStaticMarkup(
      createElement(AppShell, { role, email: "test@example.test" }),
    );
    if (role === "SUPER_ADMIN") {
      for (const route of [
        "/admin",
        "/admin/companies",
        "/admin/users",
        "/admin/system-logs",
        "/admin/settings",
        "/admin/integrations",
      ])
        assert.ok(markup.includes(`href="${route}"`));
      assert.doesNotMatch(markup, /href="\/dashboard"|href="\/my-dashboard"/);
    } else assert.doesNotMatch(markup, /href="\/admin/);
  }
  assert.equal(getRoleHomeRoute("SUPER_ADMIN"), "/admin");
});

test("admin screens render headings, initial loading states and accessible controls", () => {
  for (const [component, title] of [
    [AdminCompanies, en.admin.companies],
    [AdminUsers, en.admin.users],
    [AdminLogs, en.admin.logs],
    [AdminOverview, en.admin.overview],
  ] as const) {
    const markup = renderToStaticMarkup(createElement(component));
    assert.ok(markup.includes(title));
    assert.match(markup, /animate-pulse/);
  }
  assert.ok(
    renderToStaticMarkup(
      createElement(AdminInformation, { section: "settings" }),
    ).includes(en.admin.settings),
  );
});

test("all admin translation keys are present and nonempty in EN and TR", () => {
  assert.deepEqual(Object.keys(en.admin).sort(), Object.keys(tr.admin).sort());
  for (const dictionary of [en.admin, tr.admin])
    for (const value of Object.values(dictionary))
      assert.ok(value.trim().length);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DemoLoginPanel } from "./demo-login-panel";

test("demo login panel offers all three roles and separate data actions", () => {
  const markup = renderToStaticMarkup(
    createElement(DemoLoginPanel, {
      accounts: [
        {
          role: "SUPER_ADMIN",
          email: "admin@worklens.demo",
          label: "Super Admin",
        },
        { role: "MANAGER", email: "manager@worklens.demo", label: "Manager" },
        {
          role: "EMPLOYEE",
          email: "employee@worklens.demo",
          label: "Employee",
        },
      ],
      password: "Demo1234!",
    }),
  );

  assert.match(markup, /Sign in as Super Admin/);
  assert.match(markup, /Sign in as Manager/);
  assert.match(markup, /Sign in as Employee/);
  assert.match(markup, /Seed demo data/);
  assert.match(markup, /Reset demo data/);
  assert.match(markup, /md:grid-cols-3/);
  assert.match(markup, /whitespace-normal/);
  assert.match(markup, /min-h-9/);
});

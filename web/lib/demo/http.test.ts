import assert from "node:assert/strict";
import test from "node:test";

import { createDemoPostHandler } from "./http";

const summary = {
  action: "reset" as const,
  companies: 2,
  users: 10,
  employees: 10,
  projects: 4,
  tasks: 12,
  activities: 160,
  anomalies: 4,
};

test("disabled demo endpoints do not execute their operation", async () => {
  let invoked = false;
  const handler = createDemoPostHandler(() => false, async () => {
    invoked = true;
    return summary;
  });

  const response = await handler(
    new Request("http://localhost/api/demo/seed", { method: "POST" }),
  );

  assert.equal(response.status, 404);
  assert.equal(invoked, false);
});

test("enabled demo endpoints return a private summary", async () => {
  const handler = createDemoPostHandler(() => true, async () => summary);
  const response = await handler(
    new Request("http://localhost/api/demo/seed", {
      method: "POST",
      headers: { origin: "http://localhost" },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).data.companies, 2);
});

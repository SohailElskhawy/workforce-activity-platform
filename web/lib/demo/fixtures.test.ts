import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemoFixturePlan,
  demoFixtureCompanyWhere,
} from "./fixtures";

test("demo fixture plan contains a complete no-duplicate presentation dataset", () => {
  const plan = buildDemoFixturePlan(new Date("2026-09-09T12:00:00Z"));

  assert.equal(plan.companyCount, 2);
  assert.deepEqual(
    new Set(plan.projectStatuses),
    new Set(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  );
  assert.deepEqual(
    new Set(plan.taskStatuses),
    new Set([
      "TODO",
      "IN_PROGRESS",
      "BLOCKED",
      "REVIEW",
      "COMPLETED",
      "CANCELLED",
    ]),
  );
  assert.deepEqual(
    demoFixtureCompanyWhere(),
    { demoFixtureSet: "worklens-client-demo" },
  );
});

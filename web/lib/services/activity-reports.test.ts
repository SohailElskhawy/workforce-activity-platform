import assert from "node:assert/strict";
import test from "node:test";

import { assertEmployeeActivityScope, manualActivityDifference, summarizeActivities } from "@/lib/services/activity-reports";
import { ApiError } from "@/lib/http/errors";

test("manualActivityDifference keeps manual time and activity separate", () => {
  assert.equal(manualActivityDifference(120, 5_400), 30);
  assert.equal(manualActivityDifference(45, 5_400), -45);
});

test("summarizeActivities separates active, idle, and application totals", () => {
  const summary = summarizeActivities([
    { applicationName: "AutoCAD", durationSeconds: 3_600, type: "APPLICATION" },
    { applicationName: null, durationSeconds: 1_800, type: "IDLE" },
    { applicationName: "Chrome", durationSeconds: 1_800, type: "APPLICATION" },
    { applicationName: "AutoCAD", durationSeconds: 300, type: "APPLICATION" },
  ]);

  assert.deepEqual(summary, {
    activeSeconds: 5_700,
    applications: [
      { durationSeconds: 3_900, name: "AutoCAD" },
      { durationSeconds: 1_800, name: "Chrome" },
    ],
    idleSeconds: 1_800,
  });
});

test("assertEmployeeActivityScope blocks an employee from another employee's activity", () => {
  assert.throws(
    () => assertEmployeeActivityScope({ companyId: "company-1", employeeId: "employee-1", role: "EMPLOYEE", userId: "user-1" }, "employee-2"),
    (error) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
  assert.doesNotThrow(() => assertEmployeeActivityScope({ companyId: "company-1", employeeId: null, role: "MANAGER", userId: "user-1" }, "employee-2"));
});

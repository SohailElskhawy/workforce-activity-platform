import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEmployeeActivityScope,
  manualActivityDifference,
  summarizeActivities,
} from "@/lib/services/activity-reports";
import { formatActivityDifference } from "@/lib/formatters";
import {
  projectTrackedPercentage,
  toTimelineLabel,
} from "@/lib/services/activity-presentation";
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
    () =>
      assertEmployeeActivityScope(
        {
          companyId: "company-1",
          employeeId: "employee-1",
          role: "EMPLOYEE",
          userId: "user-1",
        },
        "employee-2",
      ),
    (error) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
  assert.doesNotThrow(() =>
    assertEmployeeActivityScope(
      {
        companyId: "company-1",
        employeeId: null,
        role: "MANAGER",
        userId: "user-1",
      },
      "employee-2",
    ),
  );
});

test("formatActivityDifference uses neutral manual-versus-activity copy", () => {
  assert.equal(
    formatActivityDifference(30),
    "30m more manual time than activity time",
  );
  assert.equal(
    formatActivityDifference(-30),
    "30m more activity time than manual time",
  );
  assert.equal(formatActivityDifference(0), "Manual and activity time match");
});

test("toTimelineLabel identifies unmapped file activity without hiding it", () => {
  assert.equal(
    toTimelineLabel({
      applicationName: "AutoCAD",
      fileName: "Unknown.dwg",
      project: null,
      type: "APPLICATION",
    }),
    "Unmapped",
  );
  assert.equal(
    toTimelineLabel({
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      project: { code: "ABC" },
      type: "APPLICATION",
    }),
    "ABC",
  );
  assert.equal(
    toTimelineLabel({
      applicationName: null,
      fileName: null,
      project: null,
      type: "IDLE",
    }),
    "Idle",
  );
});

test("projectTrackedPercentage compares activity with an estimate without treating it as worked time", () => {
  assert.equal(projectTrackedPercentage(1_800, 1), 50);
  assert.equal(projectTrackedPercentage(7_200, 1), 100);
  assert.equal(projectTrackedPercentage(1_800, null), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmployeeLeaveSchema,
  updateEmployeeLeaveSchema,
} from "@/lib/validation/leaves";

test("leave validation accepts a bounded free-text type and valid inclusive date range", () => {
  const result = createEmployeeLeaveSchema.parse({
    employeeId: "11111111-1111-4111-8111-111111111111",
    endDate: "2026-09-15",
    leaveType: "  Annual Leave  ",
    notes: "  Family travel.  ",
    startDate: "2026-09-10",
  });

  assert.equal(result.leaveType, "Annual Leave");
  assert.equal(result.notes, "Family travel.");
  assert.equal(result.status, "APPROVED");
  assert.equal(result.startDate.toISOString(), "2026-09-10T00:00:00.000Z");
});

test("leave validation rejects inverted ranges, blank types, and unrecognized statuses", () => {
  assert.equal(
    createEmployeeLeaveSchema.safeParse({
      employeeId: "11111111-1111-4111-8111-111111111111",
      endDate: "2026-09-09",
      leaveType: "Annual Leave",
      startDate: "2026-09-10",
    }).success,
    false,
  );
  assert.equal(
    createEmployeeLeaveSchema.safeParse({
      employeeId: "11111111-1111-4111-8111-111111111111",
      endDate: "2026-09-10",
      leaveType: " ",
      startDate: "2026-09-10",
    }).success,
    false,
  );
  assert.equal(
    updateEmployeeLeaveSchema.safeParse({ status: "UNKNOWN" }).success,
    false,
  );
});

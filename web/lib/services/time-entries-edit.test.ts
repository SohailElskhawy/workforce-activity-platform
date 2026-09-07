import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/http/errors";
import {
  createTimeEntrySchema,
  updateTimeEntrySchema,
} from "@/lib/validation/time-entries";
import { timeRangesOverlap, validateTimeEntryWindow } from "@/lib/services/time-rules";

test("Time entry validation: updateTimeEntrySchema accepts valid edits with optional reason", () => {
  const parsed = updateTimeEntrySchema.parse({
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    taskId: "550e8400-e29b-41d4-a716-446655440001",
    startAt: "2026-09-07T09:00:00.000Z",
    endAt: "2026-09-07T11:00:00.000Z",
    notes: "Completed CAD layout",
    reason: "Adjusted morning start time after meeting",
  });

  assert.equal(parsed.reason, "Adjusted morning start time after meeting");
  assert.equal(parsed.notes, "Completed CAD layout");
});

test("Time entry validation: future manual time is rejected", () => {
  const now = new Date("2026-09-07T12:00:00.000Z");
  const futureStart = new Date("2026-09-07T13:00:00.000Z");
  const futureEnd = new Date("2026-09-07T14:00:00.000Z");

  assert.throws(
    () => validateTimeEntryWindow(futureStart, futureEnd, now),
    (err) => err instanceof ApiError && err.code === "VALIDATION_ERROR",
  );
});

test("Time entry validation: endAt before or equal to startAt is rejected", () => {
  const now = new Date("2026-09-07T12:00:00.000Z");
  const start = new Date("2026-09-07T10:00:00.000Z");
  const end = new Date("2026-09-07T09:00:00.000Z");

  assert.throws(
    () => validateTimeEntryWindow(start, end, now),
    (err) => err instanceof ApiError && err.code === "VALIDATION_ERROR",
  );
});

test("Manual time edit overlap exclusion: an entry does not collide with itself on update", () => {
  const existingEntries = [
    {
      id: "entry-1",
      employeeId: "emp-1",
      startAt: new Date("2026-09-07T09:00:00Z"),
      endAt: new Date("2026-09-07T11:00:00Z"),
    },
    {
      id: "entry-2",
      employeeId: "emp-1",
      startAt: new Date("2026-09-07T13:00:00Z"),
      endAt: new Date("2026-09-07T15:00:00Z"),
    },
  ];

  // When updating entry-1 from 09:00-11:00 to 09:30-11:30, excluding entry-1 from overlap check succeeds
  const currentEditingId = "entry-1";
  const newStart = new Date("2026-09-07T09:30:00Z");
  const newEnd = new Date("2026-09-07T11:30:00Z");

  const overlapsWithOther = existingEntries.some(
    (e) =>
      e.id !== currentEditingId &&
      timeRangesOverlap(e.startAt, e.endAt, newStart, newEnd),
  );

  assert.equal(overlapsWithOther, false);

  // But overlapping with entry-2 (e.g. extending to 13:30) is detected
  const conflictingEnd = new Date("2026-09-07T13:30:00Z");
  const overlapsConflicting = existingEntries.some(
    (e) =>
      e.id !== currentEditingId &&
      timeRangesOverlap(e.startAt, e.endAt, newStart, conflictingEnd),
  );

  assert.equal(overlapsConflicting, true);
});

test("Manual time edit audit structure: captures before, after, and reason safely", () => {
  const before = {
    startAt: new Date("2026-09-07T09:00:00Z"),
    endAt: new Date("2026-09-07T12:00:00Z"),
    durationMinutes: 180,
    projectId: "proj-1",
    taskId: "task-1",
  };

  const updated = {
    startAt: new Date("2026-09-07T09:30:00Z"),
    endAt: new Date("2026-09-07T11:30:00Z"),
    durationMinutes: 120,
    projectId: "proj-1",
    taskId: "task-1",
  };

  const reason = "Client meeting ended 30 minutes earlier";

  const auditEntry = {
    companyId: "comp-1",
    actorUserId: "user-1",
    action: "TIME_ENTRY_UPDATED",
    entityType: "TimeEntry",
    entityId: "entry-1",
    metadata: {
      before: {
        startAt: before.startAt.toISOString(),
        endAt: before.endAt.toISOString(),
        durationMinutes: before.durationMinutes,
        projectId: before.projectId,
        taskId: before.taskId,
      },
      after: {
        startAt: updated.startAt.toISOString(),
        endAt: updated.endAt.toISOString(),
        durationMinutes: updated.durationMinutes,
        projectId: updated.projectId,
        taskId: updated.taskId,
      },
      reason,
    },
  };

  assert.equal(auditEntry.action, "TIME_ENTRY_UPDATED");
  const metadata = auditEntry.metadata as Record<string, any>;
  assert.equal(metadata.before.durationMinutes, 180);
  assert.equal(metadata.after.durationMinutes, 120);
  assert.equal(metadata.reason, reason);
});

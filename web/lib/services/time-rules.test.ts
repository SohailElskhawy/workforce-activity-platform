import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/http/errors";
import {
  timeRangesOverlap,
  validateTimeEntryWindow,
} from "@/lib/services/time-rules";

const existingStart = new Date("2026-09-01T09:00:00Z");
const existingEnd = new Date("2026-09-01T12:00:00Z");

test("timeRangesOverlap rejects every overlapping range and allows adjacent entries", () => {
  assert.equal(
    timeRangesOverlap(
      existingStart,
      existingEnd,
      new Date("2026-09-01T11:30:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    ),
    true,
  );
  assert.equal(
    timeRangesOverlap(
      existingStart,
      existingEnd,
      new Date("2026-09-01T08:00:00Z"),
      new Date("2026-09-01T09:30:00Z"),
    ),
    true,
  );
  assert.equal(
    timeRangesOverlap(
      existingStart,
      existingEnd,
      new Date("2026-09-01T09:30:00Z"),
      new Date("2026-09-01T10:30:00Z"),
    ),
    true,
  );
  assert.equal(
    timeRangesOverlap(
      existingStart,
      existingEnd,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    ),
    false,
  );
});

test("validateTimeEntryWindow rejects future and invalid ranges", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  assert.throws(
    () =>
      validateTimeEntryWindow(
        new Date("2026-09-02T11:00:00Z"),
        new Date("2026-09-02T13:00:00Z"),
        now,
      ),
    (error) => error instanceof ApiError && error.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () =>
      validateTimeEntryWindow(
        new Date("2026-09-02T11:00:00Z"),
        new Date("2026-09-02T11:00:00Z"),
        now,
      ),
    (error) => error instanceof ApiError && error.code === "VALIDATION_ERROR",
  );
  assert.doesNotThrow(() =>
    validateTimeEntryWindow(
      new Date("2026-09-02T09:00:00Z"),
      new Date("2026-09-02T10:00:00Z"),
      now,
    ),
  );
});

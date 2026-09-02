import { ApiError } from "@/lib/http/errors";

const MAX_ENTRY_DURATION_MS = 24 * 60 * 60 * 1_000;

export function validateTimeEntryWindow(
  startAt: Date,
  endAt: Date,
  now = new Date(),
) {
  if (startAt >= endAt) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "End time must be after start time.",
      400,
    );
  }

  if (endAt > now || startAt > now) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Time entries cannot be in the future.",
      400,
    );
  }

  if (endAt.getTime() - startAt.getTime() > MAX_ENTRY_DURATION_MS) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "A time entry cannot be longer than 24 hours.",
      400,
    );
  }
}

export function durationInMinutes(startAt: Date, endAt: Date) {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
}

/** The database overlap predicate: existing.start < incoming.end && existing.end > incoming.start. */
export function timeRangesOverlap(
  existingStart: Date,
  existingEnd: Date,
  incomingStart: Date,
  incomingEnd: Date,
) {
  return existingStart < incomingEnd && existingEnd > incomingStart;
}

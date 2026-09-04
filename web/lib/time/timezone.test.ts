import assert from "node:assert/strict";
import test from "node:test";

import { APP_TIMEZONE, getZonedDayBounds } from "@/lib/time/timezone";

test("getZonedDayBounds calculates correct UTC boundaries for Europe/Istanbul", () => {
  const { dayStr, startAt, endAt } = getZonedDayBounds("2026-09-04");

  assert.equal(dayStr, "2026-09-04");
  // 2026-09-04 00:00:00 Europe/Istanbul is 2026-09-03 21:00:00 UTC
  assert.equal(startAt.toISOString(), "2026-09-03T21:00:00.000Z");
  // 2026-09-05 00:00:00 Europe/Istanbul is 2026-09-04 21:00:00 UTC
  assert.equal(endAt.toISOString(), "2026-09-04T21:00:00.000Z");
});

test("activity at UTC 21:30 correctly belongs to the next Turkish calendar date", () => {
  const { startAt, endAt } = getZonedDayBounds("2026-09-04");

  // Activity at 2026-09-03 21:30:00 UTC (00:30 Istanbul on Sept 4)
  const activitySept4 = new Date("2026-09-03T21:30:00.000Z");
  assert.ok(activitySept4 >= startAt && activitySept4 < endAt);

  // Activity at 2026-09-03 20:59:59 UTC (23:59:59 Istanbul on Sept 3)
  const activitySept3 = new Date("2026-09-03T20:59:59.000Z");
  assert.ok(activitySept3 < startAt);

  // Activity at 2026-09-04 20:59:59 UTC (23:59:59 Istanbul on Sept 4)
  const activityEndSept4 = new Date("2026-09-04T20:59:59.000Z");
  assert.ok(activityEndSept4 >= startAt && activityEndSept4 < endAt);

  // Activity at 2026-09-04 21:00:00 UTC (00:00:00 Istanbul on Sept 5)
  const activitySept5 = new Date("2026-09-04T21:00:00.000Z");
  assert.ok(activitySept5 >= endAt);
});

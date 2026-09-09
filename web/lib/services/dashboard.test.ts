import assert from "node:assert/strict";
import test from "node:test";

import { buildActivityTrend } from "./dashboard-trend";

test("dashboard trend returns seven ordered and zero-filled day buckets", () => {
  const trend = buildActivityTrend(
    [
      { startAt: new Date("2026-09-07T09:00:00.000Z"), durationSeconds: 120 },
      { startAt: new Date("2026-09-07T14:00:00.000Z"), durationSeconds: 180 },
    ],
    new Date("2026-09-09T12:00:00.000Z"),
  );

  assert.equal(trend.length, 7);
  assert.deepEqual(trend.at(-3), { day: "2026-09-07", seconds: 300 });
  assert.deepEqual(trend.at(-1), { day: "2026-09-09", seconds: 0 });
});

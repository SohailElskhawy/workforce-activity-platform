import assert from "node:assert/strict";
import test from "node:test";

import { getAgentConnectionStatus } from "@/lib/services/employees";

const now = new Date("2026-09-02T18:30:00.000Z");

test("getAgentConnectionStatus identifies enrolled agents with recent heartbeats as online", () => {
  assert.equal(
    getAgentConnectionStatus(new Date("2026-09-02T18:29:00.000Z"), now),
    "ONLINE",
  );
});

test("getAgentConnectionStatus distinguishes an offline agent from an employee without a device", () => {
  assert.equal(
    getAgentConnectionStatus(new Date("2026-09-02T18:28:29.000Z"), now),
    "OFFLINE",
  );
  assert.equal(getAgentConnectionStatus(null, now), "NOT_ENROLLED");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  recordHeartbeat,
  type HeartbeatStore,
} from "@/lib/services/heartbeats";

const device = {
  companyId: "company-1",
  databaseId: "device-record-1",
  employeeId: "employee-1",
  publicId: "PC-TEST-001",
};

test("recordHeartbeat stores server time rather than the agent timestamp", async () => {
  const updates: Array<{ id: string; agentVersion: string; lastSeenAt: Date }> =
    [];
  const store: HeartbeatStore = {
    async updateDevice(update) {
      updates.push(update);
    },
  };
  const serverNow = new Date("2026-09-01T10:00:00.000Z");

  const result = await recordHeartbeat(
    device,
    { agentVersion: "0.1.0", timestamp: new Date("2000-01-01T00:00:00.000Z") },
    store,
    () => serverNow,
  );

  assert.deepEqual(result, { lastSeenAt: serverNow });
  assert.deepEqual(updates, [
    { agentVersion: "0.1.0", id: "device-record-1", lastSeenAt: serverNow },
  ]);
});

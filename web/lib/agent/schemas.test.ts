import assert from "node:assert/strict";
import test from "node:test";

import { activityBatchSchema, heartbeatSchema, registerDeviceSchema } from "@/lib/agent/schemas";

const validEvent = {
  endAt: "2026-09-01T09:15:00.000Z",
  eventId: "5f277e32-f602-4bf2-8772-5ce109604bc8",
  startAt: "2026-09-01T09:00:00.000Z",
  type: "APPLICATION",
};

test("activityBatchSchema rejects identity fields and batches larger than 100", () => {
  assert.equal(
    activityBatchSchema.safeParse({ activities: [{ ...validEvent, companyId: "forged-company" }] }).success,
    false,
  );
  assert.equal(
    activityBatchSchema.safeParse({ activities: Array.from({ length: 101 }, () => validEvent) }).success,
    false,
  );
});

test("activityBatchSchema accepts bounded agent capture metadata", () => {
  const result = activityBatchSchema.safeParse({
    activities: [{ ...validEvent, applicationName: "AutoCAD", fileName: "ABC_A_Block.dwg", processName: "acad.exe" }],
  });

  assert.equal(result.success, true);
});

test("registerDeviceSchema and heartbeatSchema reject unrecognized fields", () => {
  assert.equal(registerDeviceSchema.safeParse({ employeeId: "employee-1", name: "MEHMET-PC", role: "MANAGER" }).success, false);
  assert.equal(heartbeatSchema.safeParse({ agentVersion: "0.1.0", timestamp: "2026-09-01T09:00:00.000Z", deviceId: "forged" }).success, false);
});

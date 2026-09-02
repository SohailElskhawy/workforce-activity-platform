import assert from "node:assert/strict";
import test from "node:test";

import { authenticateDevice } from "@/lib/agent/authenticate";
import { activityBatchSchema } from "@/lib/agent/schemas";
import { hashAgentToken } from "@/lib/agent/token";
import { assertRole, tenantWhere, type AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { parseRequestBody } from "@/lib/http/request";
import { assertEmployeeActivityScope } from "@/lib/services/activity-reports";
import {
  type AgentActivityStore,
  ingestActivityBatch,
} from "@/lib/services/activities";
import {
  timeRangesOverlap,
  validateTimeEntryWindow,
} from "@/lib/services/time-rules";
import { assertDueDateNotPast } from "@/lib/validation/tasks";
import { createTimeEntrySchema } from "@/lib/validation/time-entries";
import type { AgentActivityInput } from "@/lib/agent/schemas";

const companyAEmployee: AuthContext = {
  companyId: "company-a",
  employeeId: "11111111-1111-4111-8111-111111111111",
  role: "EMPLOYEE",
  userId: "user-a",
};
const companyBEmployeeId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

const event: AgentActivityInput = {
  endAt: new Date("2026-09-02T09:15:00.000Z"),
  eventId: "44444444-4444-4444-8444-444444444444",
  startAt: new Date("2026-09-02T09:00:00.000Z"),
  type: "APPLICATION",
};

function isCode(code: ApiError["code"]) {
  return (error: unknown) => error instanceof ApiError && error.code === code;
}

test("Employee A cannot read Employee B activity", () => {
  assert.throws(
    () => assertEmployeeActivityScope(companyAEmployee, companyBEmployeeId),
    isCode("FORBIDDEN"),
  );
});

test("manager Company A tenant scopes guessed Company B employee IDs", () => {
  assert.deepEqual(tenantWhere("company-a", { id: companyBEmployeeId }), {
    companyId: "company-a",
    id: companyBEmployeeId,
  });
});

test("manager Company A tenant scopes assignment employee IDs", () => {
  assert.deepEqual(
    tenantWhere("company-a", { id: companyBEmployeeId, taskId: "task-a" }),
    { companyId: "company-a", id: companyBEmployeeId, taskId: "task-a" },
  );
});

test("employees cannot use the manager role required by project and task routes", () => {
  assert.throws(
    () => assertRole(companyAEmployee, ["MANAGER"]),
    isCode("FORBIDDEN"),
  );
});

test("employee manual-time payloads reject another employee ID", async () => {
  const body = {
    projectId,
    startAt: "2026-09-02T08:00:00.000Z",
    endAt: "2026-09-02T09:00:00.000Z",
    employeeId: companyBEmployeeId,
  };

  assert.equal(createTimeEntrySchema.safeParse(body).success, false);
  await assert.rejects(
    () =>
      parseRequestBody(
        new Request("http://example.test/api/my/time-entries", {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        createTimeEntrySchema,
      ),
    isCode("VALIDATION_ERROR"),
  );
});

test("invalid and revoked agent tokens are rejected", async () => {
  process.env.AGENT_TOKEN_PEPPER = "security-regression-pepper";
  const device = {
    agentTokenHash: hashAgentToken("valid-agent-token"),
    companyId: "company-a",
    deviceId: "DEVICE-A",
    employeeId: companyAEmployee.employeeId!,
    id: "device-record-a",
    isActive: true,
  };
  const validRequest = new Request(
    "http://example.test/api/agent/activities/batch",
    {
      headers: {
        authorization: "Bearer valid-agent-token",
        "x-device-id": "DEVICE-A",
      },
    },
  );

  await assert.rejects(
    () =>
      authenticateDevice(
        new Request("http://example.test/api/agent/activities/batch", {
          headers: {
            authorization: "Bearer invalid-agent-token",
            "x-device-id": "DEVICE-A",
          },
        }),
        async () => device,
      ),
    isCode("UNAUTHORIZED"),
  );
  await assert.rejects(
    () =>
      authenticateDevice(validRequest, async () => ({
        ...device,
        isActive: false,
      })),
    isCode("UNAUTHORIZED"),
  );
});

test("agent route payloads reject supplied company and employee identity", async () => {
  const payload = {
    activities: [
      {
        endAt: "2026-09-02T09:15:00.000Z",
        eventId: event.eventId,
        startAt: "2026-09-02T09:00:00.000Z",
        type: "APPLICATION",
        companyId: "company-b",
        employeeId: companyBEmployeeId,
      },
    ],
  };

  assert.equal(activityBatchSchema.safeParse(payload).success, false);
  await assert.rejects(
    () =>
      parseRequestBody(
        new Request("http://example.test/api/agent/activities/batch", {
          body: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        activityBatchSchema,
      ),
    isCode("VALIDATION_ERROR"),
  );
});

test("duplicate agent events cannot increase stored activity totals", async () => {
  const rows: Array<{ durationSeconds: number }> = [];
  const seen = new Set<string>();
  const store: AgentActivityStore = {
    async createActivity(activity) {
      const key = `${activity.deviceId}:${activity.eventId}`;
      if (seen.has(key)) return "duplicate";
      seen.add(key);
      rows.push(activity);
      return "created";
    },
    async findFileMapping() {
      return null;
    },
  };
  const device = {
    companyId: "company-a",
    databaseId: "device-record-a",
    employeeId: companyAEmployee.employeeId!,
    publicId: "DEVICE-A",
  };

  await ingestActivityBatch(device, [event, event], store);

  assert.equal(rows.length, 1);
  assert.equal(
    rows.reduce((total, row) => total + row.durationSeconds, 0),
    900,
  );
});

test("past new deadlines are rejected", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  assert.throws(
    () => assertDueDateNotPast(yesterday),
    isCode("VALIDATION_ERROR"),
  );
});

test("future manual time is rejected", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  assert.throws(
    () =>
      validateTimeEntryWindow(
        new Date("2026-09-02T11:00:00.000Z"),
        new Date("2026-09-02T12:01:00.000Z"),
        now,
      ),
    isCode("VALIDATION_ERROR"),
  );
});

test("overlapping manual time is rejected by the persistence predicate", () => {
  assert.equal(
    timeRangesOverlap(
      new Date("2026-09-02T09:00:00.000Z"),
      new Date("2026-09-02T10:00:00.000Z"),
      new Date("2026-09-02T09:30:00.000Z"),
      new Date("2026-09-02T10:30:00.000Z"),
    ),
    true,
  );
});

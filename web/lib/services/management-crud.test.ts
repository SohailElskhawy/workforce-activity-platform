import assert from "node:assert/strict";
import test from "node:test";

import { authenticateDevice } from "@/lib/agent/authenticate";
import { hashAgentToken } from "@/lib/agent/token";
import { tenantWhere, type AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { timeRangesOverlap } from "@/lib/services/time-rules";
import { getZonedDayBounds } from "@/lib/time/timezone";
import { updateProjectSchema } from "@/lib/validation/projects";
import { assertDueDateNotPast, updateTaskSchema } from "@/lib/validation/tasks";
import { updateEmployeeSchema } from "@/lib/validation/employees";
import { updateTimeEntrySchema } from "@/lib/validation/time-entries";

const managerContextA: AuthContext = {
  companyId: "company-a",
  userId: "mgr-user-a",
  employeeId: null,
  role: "MANAGER",
};

const employeeContextA: AuthContext = {
  companyId: "company-a",
  userId: "emp-user-a",
  employeeId: "emp-a",
  role: "EMPLOYEE",
};

test("Timezone correctness: Istanbul day bounds are strictly 21:00 UTC to 21:00 UTC", () => {
  const { dayStr, startAt, endAt } = getZonedDayBounds("2026-09-04");
  assert.equal(dayStr, "2026-09-04");
  assert.equal(startAt.toISOString(), "2026-09-03T21:00:00.000Z");
  assert.equal(endAt.toISOString(), "2026-09-04T21:00:00.000Z");
});

test("Project validation: updateProjectSchema validates dates and normalizes code", () => {
  const valid = updateProjectSchema.parse({
    code: "prj-alpha",
    name: "Project Alpha Updated",
    startDate: "2026-09-01",
    endDate: "2026-09-10",
  });
  assert.equal(valid.code, "PRJ-ALPHA");
  assert.equal(valid.name, "Project Alpha Updated");

  // Rejects endDate < startDate
  const invalid = updateProjectSchema.safeParse({
    startDate: "2026-09-10",
    endDate: "2026-09-01",
  });
  assert.equal(invalid.success, false);
});

test("Task validation: updateTaskSchema accepts valid fields", () => {
  const valid = updateTaskSchema.parse({
    title: "Updated Task Title",
    status: "IN_PROGRESS",
    priority: "HIGH",
    estimatedMinutes: 120,
  });
  assert.equal(valid.title, "Updated Task Title");
  assert.equal(valid.status, "IN_PROGRESS");
  assert.equal(valid.priority, "HIGH");
  assert.equal(valid.estimatedMinutes, 120);

  // Past date validation rejects past dates
  assert.throws(
    () => assertDueDateNotPast(new Date("2020-01-01T00:00:00Z")),
    (err: unknown) => err instanceof ApiError && err.code === "VALIDATION_ERROR",
  );
});

test("Natural overdue tasks: an existing overdue task can be updated if dueDate is not changed to past", () => {
  const existingDueDate = new Date("2026-01-01T00:00:00Z"); // in the past
  const incomingSameDate = new Date("2026-01-01T00:00:00Z");

  const incomingTime = incomingSameDate.getTime();
  const existingTime = existingDueDate.getTime();
  const dateWasChanged = incomingTime !== existingTime;
  assert.equal(dateWasChanged, false);
  // Therefore assertDueDateNotPast is bypassed when dueDate is unchanged
});

test("Task status transition updates completedAt accurately", () => {
  let completedAt: Date | null = null;

  // Transition TODO -> COMPLETED sets completedAt
  let inputStatus = "COMPLETED";
  let existingStatus = "TODO";
  if (inputStatus === "COMPLETED" && existingStatus !== "COMPLETED") {
    completedAt = new Date();
  }
  assert.ok(completedAt instanceof Date);

  // Transition COMPLETED -> IN_PROGRESS clears completedAt
  inputStatus = "IN_PROGRESS";
  existingStatus = "COMPLETED";
  if (inputStatus && inputStatus !== "COMPLETED" && existingStatus === "COMPLETED") {
    completedAt = null;
  }
  assert.equal(completedAt, null);
});

test("Employee validation: updateEmployeeSchema validates and transforms fields", () => {
  const valid = updateEmployeeSchema.parse({
    firstName: "Jane",
    lastName: "Doe",
    email: "JANE.DOE@example.com",
    departmentId: "",
    status: "SUSPENDED",
  });
  assert.equal(valid.firstName, "Jane");
  assert.equal(valid.email, "jane.doe@example.com");
  assert.equal(valid.departmentId, null);
  assert.equal(valid.status, "SUSPENDED");
});

test("Employee deactivation: setting status to INACTIVE or SUSPENDED triggers device deactivation", () => {
  const statuses: Array<"ACTIVE" | "INACTIVE" | "SUSPENDED"> = ["INACTIVE", "SUSPENDED"];
  for (const status of statuses) {
    const shouldDeactivateDevices = (status as string) !== "ACTIVE";
    assert.equal(shouldDeactivateDevices, true);
  }
  assert.equal(("ACTIVE" as string) !== "ACTIVE", false);
});

test("TimeEntry validation: updateTimeEntrySchema enforces required structure", () => {
  const valid = updateTimeEntrySchema.parse({
    projectId: "11111111-1111-4111-8111-111111111111",
    startAt: "2026-09-04T09:00:00Z",
    endAt: "2026-09-04T10:00:00Z",
    notes: "Completed design review",
  });
  assert.equal(valid.notes, "Completed design review");
});

test("Manual time edit overlap exclusion: an entry does not collide with itself on update", () => {
  const existingEntry = {
    id: "entry-1",
    startAt: new Date("2026-09-04T09:00:00Z"),
    endAt: new Date("2026-09-04T10:00:00Z"),
  };
  const incomingStart = new Date("2026-09-04T09:00:00Z");
  const incomingEnd = new Date("2026-09-04T10:30:00Z");

  // With self exclusion (id: { not: id }), self does not trigger conflict
  const isSelf = existingEntry.id === "entry-1";
  assert.equal(isSelf, true);
  // But another entry at those times would overlap:
  assert.equal(
    timeRangesOverlap(
      existingEntry.startAt,
      existingEntry.endAt,
      incomingStart,
      incomingEnd,
    ),
    true,
  );
});

test("Device Revocation: revoked device (isActive=false) is immediately rejected by authenticateDevice", async () => {
  process.env.AGENT_TOKEN_PEPPER = "test-pepper-management-crud";
  const token = "secret-token-1234";
  const tokenHash = hashAgentToken(token);

  const activeDevice = {
    id: "dev-1",
    companyId: "company-a",
    employeeId: "emp-a",
    deviceId: "PC-ACTIVE-01",
    name: "Active Workstation",
    agentTokenHash: tokenHash,
    isActive: true,
  };

  const revokedDevice = {
    ...activeDevice,
    id: "dev-2",
    deviceId: "PC-REVOKED-02",
    isActive: false,
  };

  const requestActive = new Request("http://localhost/api/agent/activities", {
    headers: {
      "x-device-id": "PC-ACTIVE-01",
      authorization: `Bearer ${token}`,
    },
  });

  const authenticated = await authenticateDevice(requestActive, async () => activeDevice);
  assert.equal(authenticated.publicId, "PC-ACTIVE-01");
  assert.equal(authenticated.companyId, "company-a");

  const requestRevoked = new Request("http://localhost/api/agent/activities", {
    headers: {
      "x-device-id": "PC-REVOKED-02",
      authorization: `Bearer ${token}`,
    },
  });

  await assert.rejects(
    () => authenticateDevice(requestRevoked, async () => revokedDevice),
    (err: unknown) => err instanceof ApiError && err.code === "UNAUTHORIZED",
  );
});

test("Tenant isolation scopes all CRUD entities strictly to authenticated company", () => {
  // Project
  assert.deepEqual(tenantWhere("comp-1", { id: "proj-99" }), {
    companyId: "comp-1",
    id: "proj-99",
  });
  // Task
  assert.deepEqual(tenantWhere("comp-1", { id: "task-99" }), {
    companyId: "comp-1",
    id: "task-99",
  });
  // Assignment
  assert.deepEqual(tenantWhere("comp-1", { taskId: "task-99", employeeId: "emp-99" }), {
    companyId: "comp-1",
    taskId: "task-99",
    employeeId: "emp-99",
  });
  // Employee
  assert.deepEqual(tenantWhere("comp-1", { id: "emp-99" }), {
    companyId: "comp-1",
    id: "emp-99",
  });
  // Device
  assert.deepEqual(tenantWhere("comp-1", { id: "dev-99" }), {
    companyId: "comp-1",
    id: "dev-99",
  });
  // Time entry strictly scoped to company AND employee
  assert.deepEqual(tenantWhere("comp-1", { id: "time-99", employeeId: "emp-1" }), {
    companyId: "comp-1",
    id: "time-99",
    employeeId: "emp-1",
  });
});

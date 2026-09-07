import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateIntervalOverlapSeconds,
  scanAnomalies,
  updateAnomalyReviewStatus,
  listAnomalies,
} from "./anomaly-detection";
import type { AuthContext } from "@/lib/auth-context";

const managerA: AuthContext = {
  userId: "user-mgr-a",
  companyId: "company-alpha",
  role: "MANAGER",
  employeeId: null,
};

const managerB: AuthContext = {
  userId: "user-mgr-b",
  companyId: "company-beta",
  role: "MANAGER",
  employeeId: null,
};

const employeeA: AuthContext = {
  userId: "user-emp-a",
  companyId: "company-alpha",
  role: "EMPLOYEE",
  employeeId: "emp-1",
};

test("Interval overlap calculation handles all boundary cases accurately", () => {
  // Case 1: Partial overlap (09:30 to 10:45 inside 09:00 to 12:00) -> 4500 seconds (75 minutes)
  const a1 = new Date("2026-09-01T09:00:00Z");
  const a2 = new Date("2026-09-01T12:00:00Z");
  const b1 = new Date("2026-09-01T09:30:00Z");
  const b2 = new Date("2026-09-01T10:45:00Z");
  assert.equal(calculateIntervalOverlapSeconds(a1, a2, b1, b2), 4500);

  // Case 2: Adjacent intervals (no overlap)
  const c1 = new Date("2026-09-01T12:00:00Z");
  const c2 = new Date("2026-09-01T13:00:00Z");
  assert.equal(calculateIntervalOverlapSeconds(a1, a2, c1, c2), 0);

  // Case 3: Completely disjoint intervals
  const d1 = new Date("2026-09-01T14:00:00Z");
  const d2 = new Date("2026-09-01T15:00:00Z");
  assert.equal(calculateIntervalOverlapSeconds(a1, a2, d1, d2), 0);

  // Case 4: Overlap spanning start
  const e1 = new Date("2026-09-01T08:30:00Z");
  const e2 = new Date("2026-09-01T09:45:00Z");
  assert.equal(calculateIntervalOverlapSeconds(a1, a2, e1, e2), 2700); // 45 minutes
});

test("Anomaly Scanner: TIME_DISCREPANCY flags >= 90 min differences and ignores small variances", async () => {
  const anomaliesTable: any[] = [];
  const fakeDb: any = {
    timeEntry: {
      findMany: async () => [
        {
          id: "te-1",
          companyId: "company-alpha",
          employeeId: "emp-1",
          projectId: "p1",
          durationMinutes: 480, // 8 hours
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T17:00:00Z"),
          project: { id: "p1", code: "PRJ-01", name: "Project One" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
        {
          id: "te-2",
          companyId: "company-alpha",
          employeeId: "emp-2",
          projectId: "p2",
          durationMinutes: 180, // 3 hours
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T12:00:00Z"),
          project: { id: "p2", code: "PRJ-02", name: "Project Two" },
          employee: { id: "emp-2", firstName: "Ali", lastName: "Can" },
        },
      ],
    },
    activity: {
      findMany: async () => [
        // For emp-1: 3 hours active on p1 -> Diff is 8h - 3h = 5h (300 min) -> HIGH severity!
        {
          id: "act-1",
          companyId: "company-alpha",
          employeeId: "emp-1",
          type: "APPLICATION",
          projectId: "p1",
          durationSeconds: 10800, // 3 hours = 180 min
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T12:00:00Z"),
          project: { id: "p1", code: "PRJ-01", name: "Project One" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
        // For emp-2: 2.5 hours active on p2 -> Diff is 3h - 2.5h = 30 min -> Below 90m threshold -> NOT flagged!
        {
          id: "act-2",
          companyId: "company-alpha",
          employeeId: "emp-2",
          type: "APPLICATION",
          projectId: "p2",
          durationSeconds: 9000, // 2.5 hours = 150 min
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T11:30:00Z"),
          project: { id: "p2", code: "PRJ-02", name: "Project Two" },
          employee: { id: "emp-2", firstName: "Ali", lastName: "Can" },
        },
      ],
    },
    employee: { findMany: async () => [] },
    project: { findMany: async () => [] },
    anomaly: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        anomaliesTable.push({ id: `anom-${anomaliesTable.length + 1}`, ...data });
      },
      update: async () => ({}),
    },
  };

  const res = await scanAnomalies(
    managerA,
    {
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    },
    fakeDb,
  );

  // Exactly 1 time discrepancy anomaly generated (emp-1)
  assert.equal(res.createdCount, 1);
  const anomaly = anomaliesTable[0];
  assert.equal(anomaly.type, "TIME_DISCREPANCY");
  assert.equal(anomaly.employeeId, "emp-1");
  assert.equal(anomaly.severity, "HIGH"); // 300 minutes diff >= 300
  assert.ok(anomaly.fingerprint.startsWith("TD:emp-1:"));
  assert.equal(anomaly.metadata.differenceMinutes, 300);
});

test("Anomaly Scanner: PROJECT_MISMATCH requires confirmed activity on different project with >= 30m overlap", async () => {
  const anomaliesTable: any[] = [];
  const fakeDb: any = {
    timeEntry: {
      findMany: async () => [
        {
          id: "te-1",
          companyId: "company-alpha",
          employeeId: "emp-1",
          projectId: "p-alpha",
          durationMinutes: 180, // 09:00 to 12:00
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T12:00:00Z"),
          project: { id: "p-alpha", code: "ALPHA", name: "Project Alpha" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
      ],
    },
    activity: {
      findMany: async () => [
        // Activity 1: On Project Beta from 09:30 to 11:00 (1h 30m overlap = 5400s >= 1800s) -> Flagged!
        {
          id: "act-1",
          companyId: "company-alpha",
          employeeId: "emp-1",
          type: "APPLICATION",
          projectId: "p-beta",
          fileName: "Beta_Plan.dwg",
          durationSeconds: 5400,
          startAt: new Date("2026-09-01T09:30:00Z"),
          endAt: new Date("2026-09-01T11:00:00Z"),
          project: { id: "p-beta", code: "BETA", name: "Project Beta" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
        // Activity 2: Unmapped DWG (projectId is null) -> Must NEVER create project mismatch!
        {
          id: "act-unmapped",
          companyId: "company-alpha",
          employeeId: "emp-1",
          type: "APPLICATION",
          projectId: null,
          fileName: "Unmapped.dwg",
          durationSeconds: 3600,
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T10:00:00Z"),
          project: null,
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
        // Activity 3: Brief 10-minute overlap on Project Gamma (600s < 1800s threshold) -> NOT flagged!
        {
          id: "act-gamma",
          companyId: "company-alpha",
          employeeId: "emp-1",
          type: "APPLICATION",
          projectId: "p-gamma",
          fileName: "Gamma.dwg",
          durationSeconds: 600,
          startAt: new Date("2026-09-01T11:40:00Z"),
          endAt: new Date("2026-09-01T11:50:00Z"),
          project: { id: "p-gamma", code: "GAMMA", name: "Project Gamma" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
      ],
    },
    employee: { findMany: async () => [] },
    project: { findMany: async () => [] },
    anomaly: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        anomaliesTable.push({ id: `anom-${anomaliesTable.length + 1}`, ...data });
      },
      update: async () => ({}),
    },
  };

  const res = await scanAnomalies(
    managerA,
    {
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    },
    fakeDb,
  );

  const mismatches = anomaliesTable.filter((a) => a.type === "PROJECT_MISMATCH");
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].metadata.manualProjectId, "p-alpha");
  assert.equal(mismatches[0].metadata.detectedProjectId, "p-beta");
  assert.equal(mismatches[0].metadata.overlapSeconds, 5400);
  assert.equal(mismatches[0].severity, "MEDIUM"); // 5400s (90 min) is >= 3600 and < 7200
});

test("Anomaly Scanner: Human review state (ACKNOWLEDGED/RESOLVED/DISMISSED) is preserved across scans", async () => {
  const existingRecords = [
    {
      id: "anom-resolved",
      companyId: "company-alpha",
      employeeId: "emp-1",
      fingerprint: "TD:emp-1:2026-09-01:p1",
      type: "TIME_DISCREPANCY",
      status: "RESOLVED",
      resolvedById: "user-mgr-a",
      resolvedAt: new Date("2026-09-01T18:00:00Z"),
      resolutionNotes: "Discussed with employee, discrepancy explained by offline client meeting.",
    },
    {
      id: "anom-dismissed",
      companyId: "company-alpha",
      employeeId: "emp-1",
      fingerprint: "PM:emp-1:2026-09-01:p-alpha:p-beta:window1",
      type: "PROJECT_MISMATCH",
      status: "DISMISSED",
      resolvedById: "user-mgr-a",
      resolvedAt: new Date("2026-09-01T18:30:00Z"),
      resolutionNotes: "Quick consultation on Beta during Alpha shift was approved.",
    },
  ];

  let updateCalled = false;
  let createCalled = false;

  const fakeDb: any = {
    timeEntry: {
      findMany: async () => [
        {
          id: "te-1",
          companyId: "company-alpha",
          employeeId: "emp-1",
          projectId: "p1",
          durationMinutes: 480,
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T17:00:00Z"),
          project: { id: "p1", code: "PRJ-01", name: "Project One" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
      ],
    },
    activity: {
      findMany: async () => [
        {
          id: "act-1",
          companyId: "company-alpha",
          employeeId: "emp-1",
          type: "APPLICATION",
          projectId: "p1",
          durationSeconds: 3600, // 1 hour -> diff 7h
          startAt: new Date("2026-09-01T09:00:00Z"),
          endAt: new Date("2026-09-01T10:00:00Z"),
          project: { id: "p1", code: "PRJ-01", name: "Project One" },
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz" },
        },
      ],
    },
    employee: { findMany: async () => [] },
    project: { findMany: async () => [] },
    anomaly: {
      findUnique: async ({ where }: any) => {
        return (
          existingRecords.find(
            (r) => r.fingerprint === where.companyId_fingerprint.fingerprint,
          ) ?? null
        );
      },
      create: async () => {
        createCalled = true;
      },
      update: async () => {
        updateCalled = true;
      },
    },
  };

  const res = await scanAnomalies(
    managerA,
    {
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    },
    fakeDb,
  );

  // Record was found and preserved, neither created nor modified!
  assert.equal(res.preservedCount, 1);
  assert.equal(res.createdCount, 0);
  assert.equal(createCalled, false);
  assert.equal(updateCalled, false);
  assert.equal(existingRecords[0].status, "RESOLVED");
  assert.ok(existingRecords[0].resolutionNotes?.includes("offline client meeting"));
});

test("updateAnomalyReviewStatus transitions status and writes structured audit log", async () => {
  const writes: any[] = [];
  const fakeDb: any = {
    anomaly: {
      findFirst: async ({ where }: any) => {
        if (where.companyId !== managerA.companyId) return null;
        return {
          id: where.id,
          companyId: where.companyId,
          employeeId: "emp-1",
          projectId: "p1",
          type: "TIME_DISCREPANCY",
          status: "OPEN",
        };
      },
      update: async ({ where, data }: any) => {
        writes.push({ action: "updateAnomaly", where, data });
        return {
          id: where.id,
          companyId: managerA.companyId,
          employeeId: "emp-1",
          projectId: "p1",
          type: "TIME_DISCREPANCY",
          ...data,
          employee: { id: "emp-1", firstName: "Mehmet", lastName: "Yilmaz", email: "m@a.com" },
          project: { id: "p1", code: "P1", name: "P1" },
          task: null,
          resolvedBy: { id: managerA.userId, email: "manager@alpha.com" },
        };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        writes.push({ action: "audit", data });
        return { id: "aud-1", ...data };
      },
    },
  };

  const updated = await updateAnomalyReviewStatus(
    managerA,
    "anom-1",
    {
      status: "RESOLVED",
      resolutionNotes: "Reviewed with team lead.",
    },
    fakeDb,
  );

  assert.equal(updated.status, "RESOLVED");
  assert.equal(updated.resolutionNotes, "Reviewed with team lead.");

  const audit = writes.find((w) => w.action === "audit");
  assert.ok(audit);
  assert.equal(audit.data.action, "ANOMALY_RESOLVED");
  assert.equal(audit.data.companyId, managerA.companyId);
});

test("Security & Tenant Isolation: Employee cannot manage anomalies and Manager A cannot access Manager B anomalies", async () => {
  const fakeDb: any = {
    anomaly: {
      findFirst: async ({ where }: any) => {
        // Company Alpha DB record
        if (where.id === "anom-alpha" && where.companyId === "company-alpha") {
          return { id: "anom-alpha", companyId: "company-alpha" };
        }
        return null;
      },
    },
  };

  // 1. Employee is forbidden
  await assert.rejects(
    async () => {
      await updateAnomalyReviewStatus(
        employeeA,
        "anom-alpha",
        { status: "RESOLVED" },
        fakeDb,
      );
    },
    { message: /do not have access|forbidden|role/i },
  );

  // 2. Manager B cannot update Company Alpha anomaly (404 NOT_FOUND)
  await assert.rejects(
    async () => {
      await updateAnomalyReviewStatus(
        managerB,
        "anom-alpha",
        { status: "RESOLVED" },
        fakeDb,
      );
    },
    { message: /Anomaly not found/i },
  );
});

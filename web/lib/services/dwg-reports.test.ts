import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateDwgActivities,
  aggregateUnmappedDwgFiles,
  extractDisplayFileName,
  isDwgFile,
  parseSafeDate,
} from "@/lib/services/dwg-reports";
import { upsertFileMapping } from "@/lib/services/file-mappings";
import { assertEmployeeActivityScope } from "@/lib/services/activity-reports";
import { ApiError } from "@/lib/http/errors";
import type { AuthContext } from "@/lib/auth-context";

test("DWG duration aggregation sums multiple segments for the same DWG (DWG A 20m + DWG A 30m = 50m)", () => {
  const result = aggregateDwgActivities([
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 1200, // 20m
      projectId: "proj-1",
      projectName: "ABC AVM",
      projectCode: "ABC",
      taskId: "task-1",
      taskTitle: "A Block Drawing",
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 1800, // 30m
      projectId: "proj-1",
      projectName: "ABC AVM",
      projectCode: "ABC",
      taskId: "task-1",
      taskTitle: "A Block Drawing",
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].fileName, "ABC_A_Block.dwg");
  assert.equal(result[0].activeSeconds, 3000); // 50m
  assert.equal(result[0].isMapped, true);
});

test("Chrome and non-DWG activity does not count toward DWG duration", () => {
  const result = aggregateDwgActivities([
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 1500, // 25m
      projectId: "proj-1",
      projectName: "ABC AVM",
      projectCode: "ABC",
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "Google Chrome",
      fileName: null,
      durationSeconds: 600, // 10m
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "Word",
      fileName: "spec.docx",
      durationSeconds: 900, // 15m
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 2100, // 35m
      projectId: "proj-1",
      projectName: "ABC AVM",
      projectCode: "ABC",
      taskId: null,
      taskTitle: null,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].fileName, "ABC_A_Block.dwg");
  assert.equal(result[0].activeSeconds, 3600); // exactly 60m (25m + 35m)
});

test("IDLE activity does not count toward DWG duration", () => {
  const result = aggregateDwgActivities([
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 1200, // 20m
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "IDLE",
      applicationName: null,
      fileName: "ABC_A_Block.dwg", // Even if idle observation has file attached
      durationSeconds: 900, // 15m
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].activeSeconds, 1200);
});

test("Filename normalization normalizes paths, casing, and dirty flags into single DWG", () => {
  const result = aggregateDwgActivities([
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "C:\\Projects\\ABC_A_Block.DWG",
      durationSeconds: 600,
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "abc_a_block.dwg*",
      durationSeconds: 600,
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 600,
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].normalizedFileName, "abc_a_block.dwg");
  assert.equal(result[0].activeSeconds, 1800);
});

test("Employee isolation aggregates separate employees independently", () => {
  const result = aggregateDwgActivities([
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 1200,
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
    {
      employeeId: "emp-2",
      employeeName: "Ayşe Kaya",
      type: "APPLICATION",
      applicationName: "AutoCAD",
      fileName: "ABC_A_Block.dwg",
      durationSeconds: 1800,
      projectId: null,
      projectName: null,
      projectCode: null,
      taskId: null,
      taskTitle: null,
    },
  ]);

  assert.equal(result.length, 2);
  const mehmet = result.find((r) => r.employeeId === "emp-1");
  const ayse = result.find((r) => r.employeeId === "emp-2");
  assert.equal(mehmet?.activeSeconds, 1200);
  assert.equal(ayse?.activeSeconds, 1800);
});

test("Employee isolation forbids an employee from accessing another employee's summary", () => {
  const employeeContext: AuthContext = {
    companyId: "company-1",
    employeeId: "employee-1",
    role: "EMPLOYEE",
    userId: "user-1",
  };

  assert.throws(
    () => assertEmployeeActivityScope(employeeContext, "employee-2"),
    (err: any) => err instanceof ApiError && err.code === "FORBIDDEN",
  );

  assert.doesNotThrow(() =>
    assertEmployeeActivityScope(employeeContext, "employee-1"),
  );
});

test("Unmapped DWG files aggregation tracks employees, first seen, last seen, and duration", () => {
  const unmapped = aggregateUnmappedDwgFiles([
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      fileName: "Unknown_Block.dwg",
      durationSeconds: 900,
      projectId: null,
      startAt: new Date("2026-09-04T09:00:00Z"),
      endAt: new Date("2026-09-04T09:15:00Z"),
    },
    {
      employeeId: "emp-2",
      employeeName: "Ayşe Kaya",
      type: "APPLICATION",
      fileName: "Unknown_Block.dwg",
      durationSeconds: 1800,
      projectId: null,
      startAt: new Date("2026-09-04T10:00:00Z"),
      endAt: new Date("2026-09-04T10:30:00Z"),
    },
    {
      employeeId: "emp-1",
      employeeName: "Mehmet Yılmaz",
      type: "APPLICATION",
      fileName: "Mapped_Block.dwg",
      durationSeconds: 600,
      projectId: "proj-1", // Already mapped
      startAt: new Date("2026-09-04T11:00:00Z"),
      endAt: new Date("2026-09-04T11:10:00Z"),
    },
  ]);

  assert.equal(unmapped.length, 1);
  assert.equal(unmapped[0].fileName, "Unknown_Block.dwg");
  assert.equal(unmapped[0].activeSeconds, 2700);
  assert.equal(unmapped[0].employees.length, 2);
  assert.equal(
    unmapped[0].firstSeenAt.toISOString(),
    "2026-09-04T09:00:00.000Z",
  );
  assert.equal(
    unmapped[0].lastSeenAt.toISOString(),
    "2026-09-04T10:30:00.000Z",
  );
});

test("Date parser validates date input safely and falls back gracefully", () => {
  const valid = parseSafeDate("2026-09-04");
  assert.equal(valid.toISOString().slice(0, 10), "2026-09-04");

  const invalid = parseSafeDate("invalid-date");
  assert.ok(invalid instanceof Date);
  assert.ok(!Number.isNaN(invalid.getTime()));

  const empty = parseSafeDate(null);
  assert.ok(empty instanceof Date);
  assert.ok(!Number.isNaN(empty.getTime()));
});

// Mock client builder for testing retroactive mapping, tenant isolation, and validation
function createMockPrisma({
  projects = [
    { id: "proj-1", companyId: "company-a" },
    { id: "proj-2", companyId: "company-b" },
  ],
  tasks = [
    { id: "task-1", projectId: "proj-1", companyId: "company-a" },
    { id: "task-2", projectId: "proj-2", companyId: "company-b" },
  ],
  activities = [] as Array<{
    id: string;
    companyId: string;
    fileName: string | null;
    projectId: string | null;
    taskId: string | null;
  }>,
} = {}) {
  const auditLogs: any[] = [];
  const mappings: any[] = [];

  const db = {
    project: {
      async findFirst({ where }: any) {
        return (
          projects.find((p) => {
            if (where.companyId && p.companyId !== where.companyId)
              return false;
            if (where.id && p.id !== where.id) return false;
            return true;
          }) ?? null
        );
      },
    },
    task: {
      async findFirst({ where }: any) {
        return (
          tasks.find((t) => {
            if (where.companyId && t.companyId !== where.companyId)
              return false;
            if (where.id && t.id !== where.id) return false;
            if (where.projectId && t.projectId !== where.projectId)
              return false;
            return true;
          }) ?? null
        );
      },
    },
    async $transaction(fn: any) {
      const tx = {
        fileMapping: {
          async upsert({ where, create, update }: any) {
            const existingIndex = mappings.findIndex(
              (m) =>
                m.companyId === where.companyId_normalizedFileName.companyId &&
                m.normalizedFileName ===
                  where.companyId_normalizedFileName.normalizedFileName,
            );
            let item;
            if (existingIndex >= 0) {
              item = { ...mappings[existingIndex], ...update };
              mappings[existingIndex] = item;
            } else {
              item = { id: `map-${mappings.length + 1}`, ...create };
              mappings.push(item);
            }
            return item;
          },
        },
        activity: {
          async updateMany({ where, data }: any) {
            let count = 0;
            for (const act of activities) {
              if (where.companyId && act.companyId !== where.companyId)
                continue;
              const match = where.OR.some((cond: any) => {
                if (cond.fileName?.equals) {
                  return (
                    act.fileName?.toLowerCase() ===
                    cond.fileName.equals.toLowerCase()
                  );
                }
                if (cond.fileName?.endsWith) {
                  return act.fileName
                    ?.toLowerCase()
                    .endsWith(cond.fileName.endsWith.toLowerCase());
                }
                return false;
              });
              if (match) {
                act.projectId = data.projectId;
                act.taskId = data.taskId;
                count++;
              }
            }
            return { count };
          },
        },
        auditLog: {
          async create({ data }: any) {
            auditLogs.push(data);
            return data;
          },
        },
      };
      return fn(tx);
    },
  };

  return { activities, auditLogs, mappings, db };
}

test("Retroactive mapping updates existing matching activity rows in the SAME company", async () => {
  const { activities, auditLogs, db } = createMockPrisma({
    activities: [
      {
        id: "act-1",
        companyId: "company-a",
        fileName: "ABC_A_Block.dwg",
        projectId: null,
        taskId: null,
      },
      {
        id: "act-2",
        companyId: "company-a",
        fileName: "C:\\Work\\abc_a_block.dwg",
        projectId: null,
        taskId: null,
      },
      {
        id: "act-3",
        companyId: "company-a",
        fileName: "OTHER_Block.dwg",
        projectId: null,
        taskId: null,
      },
    ],
  });

  const managerContext: AuthContext = {
    companyId: "company-a",
    employeeId: null,
    role: "MANAGER",
    userId: "user-mgr-a",
  };

  const result = await upsertFileMapping(
    managerContext,
    {
      fileName: "ABC_A_Block.dwg",
      projectId: "proj-1",
      taskId: "task-1",
    },
    db,
  );

  assert.equal(result.projectId, "proj-1");
  assert.equal(result.taskId, "task-1");

  // act-1 and act-2 should be retroactively mapped!
  assert.equal(activities[0].projectId, "proj-1");
  assert.equal(activities[0].taskId, "task-1");
  assert.equal(activities[1].projectId, "proj-1");
  assert.equal(activities[1].taskId, "task-1");

  // act-3 should remain unmapped
  assert.equal(activities[2].projectId, null);
  assert.equal(activities[2].taskId, null);

  // Audit log was written
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "FILE_MAPPING_UPSERTED");
  assert.equal(auditLogs[0].companyId, "company-a");
});

test("Tenant isolation: mapping in Company A never updates activities in Company B", async () => {
  const { activities, db } = createMockPrisma({
    activities: [
      {
        id: "act-a",
        companyId: "company-a",
        fileName: "Shared_Name.dwg",
        projectId: null,
        taskId: null,
      },
      {
        id: "act-b",
        companyId: "company-b",
        fileName: "Shared_Name.dwg",
        projectId: null,
        taskId: null,
      },
    ],
  });

  const companyAManager: AuthContext = {
    companyId: "company-a",
    employeeId: null,
    role: "MANAGER",
    userId: "user-mgr-a",
  };

  await upsertFileMapping(
    companyAManager,
    {
      fileName: "Shared_Name.dwg",
      projectId: "proj-1",
      taskId: "task-1",
    },
    db,
  );

  // Company A activity is updated
  assert.equal(activities[0].projectId, "proj-1");
  assert.equal(activities[0].taskId, "task-1");

  // Company B activity remains completely untouched!
  assert.equal(activities[1].projectId, null);
  assert.equal(activities[1].taskId, null);
});

test("Invalid cross-project task mapping is rejected", async () => {
  const { db } = createMockPrisma();

  const managerContext: AuthContext = {
    companyId: "company-a",
    employeeId: null,
    role: "MANAGER",
    userId: "user-mgr-a",
  };

  // task-2 belongs to proj-2, but mapping targets proj-1!
  await assert.rejects(
    () =>
      upsertFileMapping(
        managerContext,
        {
          fileName: "ABC_A_Block.dwg",
          projectId: "proj-1",
          taskId: "task-2", // Belongs to proj-2 in company-b
        },
        db,
      ),
    (err: any) =>
      err instanceof ApiError &&
      err.code === "NOT_FOUND" &&
      err.message === "Task not found in this project.",
  );
});

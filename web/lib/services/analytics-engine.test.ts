import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProcessOrApplication,
  getWorkloadAnalysis,
  getProjectPredictions,
  getAutomaticClassification,
  getManagementRecommendations,
  generateExecutiveBriefing,
  askManagementIntelligence,
} from "./analytics-engine";
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

test("Automatic Classification: correctly classifies applications and process names", () => {
  // CAD / Engineering
  assert.equal(classifyProcessOrApplication("AutoCAD 2024", "acad.exe"), "ENGINEERING_CAD");
  assert.equal(classifyProcessOrApplication("Autodesk Revit", "revit.exe"), "ENGINEERING_CAD");
  assert.equal(classifyProcessOrApplication("Civil 3D Imperial", "civil3d.exe"), "ENGINEERING_CAD");
  assert.equal(classifyProcessOrApplication("Drawing1.dwg", null), "ENGINEERING_CAD");

  // Office & Documentation
  assert.equal(classifyProcessOrApplication("Microsoft Excel", "excel.exe"), "OFFICE_DOCS");
  assert.equal(classifyProcessOrApplication("Microsoft Word", "winword.exe"), "OFFICE_DOCS");
  assert.equal(classifyProcessOrApplication("Adobe Acrobat Reader", "acrord32.exe"), "OFFICE_DOCS");

  // Communication
  assert.equal(classifyProcessOrApplication("Microsoft Teams", "teams.exe"), "COMMUNICATION");
  assert.equal(classifyProcessOrApplication("Slack", "slack.exe"), "COMMUNICATION");
  assert.equal(classifyProcessOrApplication("Outlook", "outlook.exe"), "COMMUNICATION");

  // Technical / Dev
  assert.equal(classifyProcessOrApplication("Visual Studio Code", "code.exe"), "DEV_TECHNICAL");
  assert.equal(classifyProcessOrApplication("Windows PowerShell", "powershell.exe"), "DEV_TECHNICAL");

  // Browsing & Web
  assert.equal(classifyProcessOrApplication("Google Chrome", "chrome.exe"), "BROWSING_RESEARCH");
  assert.equal(classifyProcessOrApplication("Microsoft Edge", "msedge.exe"), "BROWSING_RESEARCH");

  // Other / Fallback
  assert.equal(classifyProcessOrApplication("Calculator", "calc.exe"), "OTHER");
});

test("Workload Analysis: computes capacity utilization, overutilization, and imbalance score", async () => {
  // Mock DB with 2 employees in Company Alpha:
  // emp-1: 60 active hours in 7 days (expected: 40h -> 150% -> OVERUTILIZED)
  // emp-2: 20 active hours in 7 days (expected: 40h -> 50% -> UNDERUTILIZED)
  const fakeDb: any = {
    employee: {
      findMany: async ({ where }: any) => {
        if (where.companyId !== managerA.companyId) return [];
        return [
          {
            id: "emp-1",
            firstName: "Mehmet",
            lastName: "Yilmaz",
            position: "Senior Architect",
            departmentId: "dept-1",
            department: { id: "dept-1", name: "Architecture" },
            assignments: [
              {
                task: {
                  id: "t-1",
                  title: "Floor Plans",
                  estimatedMinutes: 600,
                  project: { id: "p-1", code: "P-101", name: "Mall Project" },
                },
              },
            ],
          },
          {
            id: "emp-2",
            firstName: "Ayse",
            lastName: "Demir",
            position: "Junior Draftsman",
            departmentId: "dept-1",
            department: { id: "dept-1", name: "Architecture" },
            assignments: [],
          },
        ];
      },
    },
    activity: {
      groupBy: async ({ where }: any) => {
        if (where.companyId !== managerA.companyId) return [];
        return [
          { employeeId: "emp-1", _sum: { durationSeconds: 60 * 3600 } }, // 60h
          { employeeId: "emp-2", _sum: { durationSeconds: 20 * 3600 } }, // 20h
        ];
      },
    },
  };

  const workload = await getWorkloadAnalysis(managerA, { periodDays: 7 }, fakeDb);

  assert.equal(workload.totalEmployees, 2);
  assert.equal(workload.overutilizedCount, 1);
  assert.equal(workload.underutilizedCount, 1);
  assert.equal(workload.optimalCount, 0);

  const emp1 = workload.items.find((i) => i.employeeId === "emp-1")!;
  assert.equal(emp1.status, "OVERUTILIZED");
  assert.equal(emp1.activeHours, 60);
  assert.equal(emp1.capacityUtilizationPercent, 150);
  assert.equal(emp1.remainingEstimatedHours, 10);

  const emp2 = workload.items.find((i) => i.employeeId === "emp-2")!;
  assert.equal(emp2.status, "UNDERUTILIZED");
  assert.equal(emp2.activeHours, 20);
  assert.equal(emp2.capacityUtilizationPercent, 50);

  assert.ok(workload.workloadImbalanceScore > 50, "Imbalance score should reflect significant variance");
});

test("Project Predictions: detects budget overrun and projects completion based on task pace", async () => {
  // Project P1: Estimated 50h, Tracked 65h -> Overrun!
  // Project P2: Estimated 100h, Tracked 40h, 50% tasks completed -> Projected = 80h (On Track)
  const fakeDb: any = {
    project: {
      findMany: async ({ where }: any) => {
        if (where.companyId !== managerA.companyId) return [];
        return [
          {
            id: "p-1",
            code: "MALL-101",
            name: "Shopping Mall A",
            status: "ACTIVE",
            estimatedHours: 50,
            tasks: [
              { id: "t-1", title: "HVAC Drawing", status: "IN_PROGRESS", estimatedMinutes: 1200 },
              { id: "t-2", title: "Electrical Drawing", status: "COMPLETED", estimatedMinutes: 1200 },
            ],
          },
          {
            id: "p-2",
            code: "TOWER-202",
            name: "Tower Office",
            status: "ACTIVE",
            estimatedHours: 100,
            tasks: [
              { id: "t-3", title: "Facade Model", status: "COMPLETED", estimatedMinutes: 1800 },
              { id: "t-4", title: "Interior Layout", status: "IN_PROGRESS", estimatedMinutes: 1800 },
            ],
          },
        ];
      },
    },
    activity: {
      groupBy: async ({ where }: any) => {
        if (where.companyId !== managerA.companyId) return [];
        return [
          { projectId: "p-1", _sum: { durationSeconds: 65 * 3600 } },
          { projectId: "p-2", _sum: { durationSeconds: 40 * 3600 } },
        ];
      },
      findMany: async () => [
        {
          projectId: "p-1",
          employeeId: "emp-1",
          taskId: "t-1",
          durationSeconds: 65 * 3600,
          applicationName: "AutoCAD 2024",
          processName: "acad.exe",
          employee: { firstName: "Mehmet", lastName: "Yilmaz" },
          task: { id: "t-1", title: "HVAC Drawing" },
        },
      ],
    },
    timeEntry: {
      groupBy: async () => [],
    },
  };

  const predictions = await getProjectPredictions(managerA, {}, fakeDb);

  assert.equal(predictions.totalProjects, 2);
  assert.equal(predictions.overrunCount, 1);

  const p1 = predictions.projects.find((p) => p.projectId === "p-1")!;
  assert.equal(p1.isOverrun, true);
  assert.equal(p1.overrunRisk, "CRITICAL");
  assert.equal(p1.trackedHours, 65);
  assert.equal(p1.varianceHours, 15);
  assert.equal(p1.topContributor?.name, "Mehmet Yilmaz");
  assert.equal(p1.topTask?.title, "HVAC Drawing");
  assert.equal(p1.mainCategory, "ENGINEERING_CAD");

  const p2 = predictions.projects.find((p) => p.projectId === "p-2")!;
  assert.equal(p2.isOverrun, false);
  assert.equal(p2.completionPercent, 50);
  assert.equal(p2.projectedHoursAtCompletion, 80);
});

test("Management Recommendations: triggers workload, overrun, and unmapped DWG recommendations", async () => {
  const fakeDb: any = {
    employee: {
      findMany: async () => [
        {
          id: "emp-1",
          firstName: "Mehmet",
          lastName: "Yilmaz",
          position: "Architect",
          departmentId: "d1",
          department: { name: "Design" },
          assignments: [{ task: { id: "t-1", estimatedMinutes: 600 } }],
        },
        {
          id: "emp-2",
          firstName: "Can",
          lastName: "Kaya",
          position: "Architect",
          departmentId: "d1",
          department: { name: "Design" },
          assignments: [],
        },
      ],
    },
    project: {
      findMany: async () => [
        {
          id: "p-1",
          code: "P-1",
          name: "Overrun Mall",
          status: "ACTIVE",
          estimatedHours: 40,
          tasks: [{ id: "t-1", title: "Site Plan", status: "IN_PROGRESS" }],
        },
      ],
    },
    activity: {
      groupBy: async () => [
        { employeeId: "emp-1", _sum: { durationSeconds: 60 * 3600 } },
        { employeeId: "emp-2", _sum: { durationSeconds: 15 * 3600 } },
        { projectId: "p-1", _sum: { durationSeconds: 55 * 3600 } },
      ],
      aggregate: async ({ where }: any) => {
        // Unmapped DWG activity aggregate
        if (where?.fileName && where?.projectId === null) {
          return { _sum: { durationSeconds: 8 * 3600 }, _count: { id: 12 } };
        }
        return { _sum: { durationSeconds: 0 } };
      },
      findMany: async () => [],
    },
    timeEntry: { groupBy: async () => [] },
    anomaly: {
      findMany: async () => [
        { id: "anom-1", type: "TIME_DISCREPANCY", severity: "HIGH", title: "Time variance 2h" },
      ],
    },
  };

  const recs = await getManagementRecommendations(managerA, fakeDb);

  assert.ok(recs.length >= 3, `Expected at least 3 recommendations, got ${recs.length}`);

  // Workload rebalance
  const workloadRec = recs.find((r) => r.category === "WORKLOAD");
  assert.ok(workloadRec);
  assert.equal(workloadRec.severity, "WARNING");

  // Project overrun
  const overrunRec = recs.find((r) => r.category === "PROJECT_RISK");
  assert.ok(overrunRec);
  assert.equal(overrunRec.severity, "CRITICAL");

  // Unmapped DWG
  const dwgRec = recs.find((r) => r.category === "DWG_MATCHING");
  assert.ok(dwgRec);
  assert.equal(dwgRec.severity, "INFO");

  // Anomaly review
  const anomRec = recs.find((r) => r.category === "ANOMALY_REVIEW");
  assert.ok(anomRec);
});

test("Management Q&A: answers questions regarding project overruns deterministically", async () => {
  const fakeDb: any = {
    project: {
      findMany: async () => [
        {
          id: "p-1",
          code: "HOTEL-5",
          name: "Grand Hotel",
          status: "ACTIVE",
          estimatedHours: 40,
          tasks: [{ id: "t-1", title: "Schematic Design", status: "IN_PROGRESS" }],
        },
      ],
    },
    activity: {
      groupBy: async () => [
        { projectId: "p-1", _sum: { durationSeconds: 52 * 3600 } },
      ],
      findMany: async () => [
        {
          projectId: "p-1",
          employeeId: "emp-1",
          taskId: "t-1",
          durationSeconds: 52 * 3600,
          applicationName: "AutoCAD 2024",
          processName: "acad.exe",
          employee: { firstName: "Ali", lastName: "Ozturk" },
          task: { id: "t-1", title: "Schematic Design" },
        },
      ],
    },
    timeEntry: { groupBy: async () => [] },
  };

  const ans = await askManagementIntelligence(
    managerA,
    "Bu hafta hangi projeler planlanan sürenin üzerinde?",
    fakeDb,
  );

  assert.ok(ans.headline.includes("1 project(s)"));
  assert.ok(ans.details[0].includes("Grand Hotel (HOTEL-5)"));
  assert.equal(ans.facts.overrunCount, 1);
  assert.equal(ans.facts.topProject, "Grand Hotel");
});

test("Security & Tenant Isolation: Employee is rejected and Manager A cannot access Manager B data", async () => {
  // Employee cannot access analytics intelligence
  await assert.rejects(
    async () => {
      await getWorkloadAnalysis(employeeA, {});
    },
    { message: /do not have access|forbidden|role/i },
  );

  await assert.rejects(
    async () => {
      await getProjectPredictions(employeeA, {});
    },
    { message: /do not have access|forbidden|role/i },
  );

  await assert.rejects(
    async () => {
      await askManagementIntelligence(employeeA, "Test question");
    },
    { message: /do not have access|forbidden|role/i },
  );

  // Tenant scoping check
  let capturedCompanyId: string | null = null;
  const fakeDb: any = {
    employee: {
      findMany: async ({ where }: any) => {
        capturedCompanyId = where.companyId;
        return [];
      },
    },
    activity: {
      groupBy: async () => [],
    },
  };

  await getWorkloadAnalysis(managerB, {}, fakeDb);
  assert.equal(capturedCompanyId, "company-beta");
});

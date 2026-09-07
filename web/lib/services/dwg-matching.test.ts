import assert from "node:assert/strict";
import test from "node:test";
import { matchDwgFile, type ProjectCandidate } from "./dwg-matcher";
import {
  applyHighConfidenceDwgMatches,
  acceptDwgSuggestion,
} from "./dwg-matching-service";
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

test("DWG Matcher: Rule A exact project-code token matches with 100% confidence", () => {
  const projects: ProjectCandidate[] = [
    { id: "p1", code: "ABC-101", name: "ABC Shopping Mall" },
    { id: "p2", code: "XYZ-202", name: "XYZ Business Center" },
  ];

  const result1 = matchDwgFile("ABC-101_A-Block.dwg", projects);
  assert.equal(result1.confidence, 1.0);
  assert.equal(result1.rule, "EXACT_CODE_TOKEN");
  assert.equal(result1.matchedProject?.id, "p1");
  assert.equal(result1.autoAppliable, true);
  assert.equal(result1.ambiguous, false);

  const resultPath = matchDwgFile("C:\\Projects\\XYZ-202\\Floor1.dwg", projects);
  assert.equal(resultPath.confidence, 1.0);
  assert.equal(resultPath.matchedProject?.id, "p2");
  assert.equal(resultPath.autoAppliable, true);
});

test("DWG Matcher: Token boundaries prevent incorrect prefix/suffix subtoken collisions", () => {
  const projects: ProjectCandidate[] = [
    { id: "p1", code: "ABC-10", name: "Alpha 10" },
  ];

  // ABC-101 contains ABC-10 as a substring, but token boundary must prevent exact token match
  const result = matchDwgFile("ABC-101_Floor.dwg", projects);
  assert.notEqual(result.rule, "EXACT_CODE_TOKEN");
  assert.equal(result.autoAppliable, false);

  // ABC-1010 should not match ABC-101
  const projects2: ProjectCandidate[] = [
    { id: "p2", code: "ABC-101", name: "Alpha 101" },
  ];
  const result2 = matchDwgFile("ABC-1010_Floor.dwg", projects2);
  assert.notEqual(result2.rule, "EXACT_CODE_TOKEN");
  assert.equal(result2.autoAppliable, false);
});

test("DWG Matcher: Rule B normalized project-code produces suggestion (90%), not auto-applied", () => {
  const projects: ProjectCandidate[] = [
    { id: "p1", code: "ABC-101", name: "Alpha Tower" },
  ];

  // Stripped code ABC101 in filename
  const result = matchDwgFile("ABC101_GroundPlan.dwg", projects);
  assert.equal(result.confidence, 0.9);
  assert.equal(result.rule, "NORMALIZED_CODE");
  assert.equal(result.matchedProject?.id, "p1");
  assert.equal(result.autoAppliable, false); // Must NOT auto-apply! Requires manager confirmation.
});

test("DWG Matcher: Rule C project-name keywords ignores stop words", () => {
  const projects: ProjectCandidate[] = [
    { id: "p1", code: "PRJ-99", name: "Metro Center Shopping Project Plan" },
  ];

  // "project", "plan" are stop words and ignored; "metro", "center" are significant
  const result = matchDwgFile("Metro_Center_Section.dwg", projects);
  assert.ok(result.confidence >= 0.75 && result.confidence <= 0.85);
  assert.equal(result.rule, "NAME_KEYWORDS");
  assert.equal(result.matchedProject?.id, "p1");
  assert.equal(result.autoAppliable, false); // Keyword match is suggestion only
});

test("DWG Matcher: Ambiguous candidates cancel auto-apply even if high confidence", () => {
  const projects: ProjectCandidate[] = [
    { id: "p1", code: "ABC-01", name: "Alpha Phase 1" },
    { id: "p2", code: "ABC-01A", name: "Alpha Phase 1A" },
  ];

  // A file that matches both closely
  const result = matchDwgFile("ABC-01_ABC-01A_Master.dwg", projects);
  assert.equal(result.ambiguous, true);
  assert.equal(result.autoAppliable, false);
  assert.ok(result.explanation.includes("Ambiguous match"));
});

test("DWG Matcher: Rule D task matching happens strictly under the chosen project", () => {
  const projects: ProjectCandidate[] = [
    {
      id: "p1",
      code: "ABC-101",
      name: "Alpha Mall",
      tasks: [
        { id: "t1", title: "Electrical Wiring Plan" },
        { id: "t2", title: "HVAC Duct Layout" },
      ],
    },
    {
      id: "p2",
      code: "XYZ-202",
      name: "Beta Tower",
      tasks: [
        { id: "t3", title: "Electrical Power Grid" },
      ],
    },
  ];

  // File belongs to ABC-101 and mentions Electrical
  const result = matchDwgFile("ABC-101_Electrical_Wiring.dwg", projects);
  assert.equal(result.matchedProject?.id, "p1");
  assert.equal(result.matchedTask?.id, "t1");
  assert.equal(result.matchedTask?.title, "Electrical Wiring Plan");
});

test("DWG Matching Service: applyHighConfidenceDwgMatches only applies >=95% unambiguous matches and updates unmapped activity", async () => {
  const writes: any[] = [];
  const fakeDb: any = {
    project: {
      findMany: async () => [
        { id: "p1", code: "ABC-101", name: "Alpha", tasks: [] },
        { id: "p2", code: "XYZ-202", name: "Beta", tasks: [] },
      ],
    },
    fileMapping: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async ({ data }: any) => {
        writes.push({ action: "createMapping", data });
        return { id: "m1", ...data };
      },
    },
    activity: {
      findMany: async () => [
        {
          id: "act-1",
          employeeId: "emp-1",
          type: "APPLICATION",
          fileName: "ABC-101_Plan.dwg",
          durationSeconds: 1200,
          projectId: null,
          startAt: new Date("2026-09-01T10:00:00Z"),
          endAt: new Date("2026-09-01T10:20:00Z"),
          employee: { firstName: "Ali", lastName: "Veli" },
        },
        {
          id: "act-2",
          employeeId: "emp-1",
          type: "APPLICATION",
          fileName: "SuggestedOnly_XYZ202.dwg", // Normalized code match -> 90% -> should NOT auto-apply!
          durationSeconds: 600,
          projectId: null,
          startAt: new Date("2026-09-01T11:00:00Z"),
          endAt: new Date("2026-09-01T11:10:00Z"),
          employee: { firstName: "Ali", lastName: "Veli" },
        },
      ],
      updateMany: async ({ where, data }: any) => {
        writes.push({ action: "updateActivity", where, data });
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        writes.push({ action: "audit", data });
        return { id: "audit-1", ...data };
      },
    },
    $transaction: async (fn: any) => fn(fakeDb),
  };

  const res = await applyHighConfidenceDwgMatches(managerA, fakeDb);
  assert.equal(res.appliedCount, 1);
  assert.deepEqual(res.matchedFileNames, ["ABC-101_Plan.dwg"]);

  // Verify created mapping is source: AUTO
  const mappingWrite = writes.find((w) => w.action === "createMapping");
  assert.ok(mappingWrite);
  assert.equal(mappingWrite.data.source, "AUTO");
  assert.equal(mappingWrite.data.projectId, "p1");

  // Verify activity update only targeted projectId: null
  const actUpdate = writes.find((w) => w.action === "updateActivity");
  assert.ok(actUpdate);
  assert.equal(actUpdate.where.projectId, null);

  // Verify audit log
  const auditWrite = writes.find((w) => w.action === "audit");
  assert.ok(auditWrite);
  assert.equal(auditWrite.data.action, "FILE_MAPPING_AUTO_MATCHED");
});

test("DWG Matching Service: Manual FileMapping always takes precedence and is never overwritten", async () => {
  const writes: any[] = [];
  const fakeDb: any = {
    project: {
      findMany: async () => [
        { id: "p1", code: "ABC-101", name: "Alpha", tasks: [] },
      ],
    },
    fileMapping: {
      // Existing mapping already exists!
      findMany: async () => [],
      findUnique: async () => ({
        id: "existing-m1",
        projectId: "p-manual",
        source: "MANUAL",
      }),
      create: async () => {
        throw new Error("Must not create mapping over existing!");
      },
    },
    activity: {
      findMany: async () => [
        {
          id: "act-1",
          employeeId: "emp-1",
          type: "APPLICATION",
          fileName: "ABC-101_Plan.dwg",
          durationSeconds: 1200,
          projectId: null,
          startAt: new Date("2026-09-01T10:00:00Z"),
          endAt: new Date("2026-09-01T10:20:00Z"),
          employee: { firstName: "Ali", lastName: "Veli" },
        },
      ],
      updateMany: async () => ({ count: 0 }),
    },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn: any) => fn(fakeDb),
  };

  const res = await applyHighConfidenceDwgMatches(managerA, fakeDb);
  assert.equal(res.appliedCount, 0);
  assert.equal(writes.length, 0);
});

test("DWG Matching Service: acceptDwgSuggestion sets source: MANUAL and writes audit", async () => {
  const writes: any[] = [];
  const fakeDb: any = {
    project: {
      findFirst: async ({ where }: any) => ({
        id: where.id,
        code: "ABC-101",
        name: "Alpha",
      }),
    },
    task: {
      findFirst: async ({ where }: any) => ({
        id: where.id,
        title: "Task 1",
      }),
    },
    fileMapping: {
      upsert: async ({ create }: any) => {
        writes.push({ action: "upsertMapping", create });
        return { id: "m-accepted", ...create };
      },
    },
    activity: {
      updateMany: async ({ where, data }: any) => {
        writes.push({ action: "updateActivity", where, data });
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        writes.push({ action: "audit", data });
        return { id: "audit-1", ...data };
      },
    },
    $transaction: async (fn: any) => fn(fakeDb),
  };

  const mapping = await acceptDwgSuggestion(
    managerA,
    {
      fileName: "Suggested_Floor1.dwg",
      projectId: "p1",
      taskId: "t1",
    },
    fakeDb,
  );

  assert.equal(mapping.source, "MANUAL");
  const audit = writes.find((w) => w.action === "audit");
  assert.ok(audit);
  assert.equal(audit.data.action, "FILE_MAPPING_SUGGESTION_ACCEPTED");
});

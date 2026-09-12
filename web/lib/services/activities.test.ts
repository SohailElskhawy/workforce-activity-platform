import assert from "node:assert/strict";
import test from "node:test";

import type { AgentActivityInput } from "@/lib/agent/schemas";
import {
  createConflictSafeActivityStore,
  ingestActivityBatch,
  type AgentActivityStore,
} from "@/lib/services/activities";
import { ApiError } from "@/lib/http/errors";

const device = {
  companyId: "company-1",
  databaseId: "device-record-1",
  employeeId: "employee-1",
  publicId: "PC-TEST-001",
};

const mappedEvent: AgentActivityInput = {
  applicationName: "AutoCAD",
  endAt: new Date("2026-09-01T09:15:00.000Z"),
  eventId: "5f277e32-f602-4bf2-8772-5ce109604bc8",
  fileName: "C:\\Projects\\ABC_A_Block.DWG",
  startAt: new Date("2026-09-01T09:00:00.000Z"),
  type: "APPLICATION",
};

function createStore(): {
  store: AgentActivityStore;
  rows: Array<Record<string, unknown>>;
} {
  const rows: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  return {
    rows,
    store: {
      async createActivity(data) {
        const key = `${data.deviceId}:${data.eventId}`;
        if (seen.has(key)) return "duplicate";
        seen.add(key);
        rows.push(data);
        return "created";
      },
      async findFileMapping(companyId, normalizedFileName) {
        if (
          companyId === "company-1" &&
          normalizedFileName === "abc_a_block.dwg"
        ) {
          return { projectId: "project-1", taskId: "task-1" };
        }
        return null;
      },
    },
  };
}

test("ingestion derives identity and resolves only configured file mappings", async () => {
  const { rows, store } = createStore();
  const unmappedEvent = {
    ...mappedEvent,
    eventId: "0c2f2c1b-2f2e-4503-94d7-a9bb91b1ff31",
    fileName: "UNKNOWN.DWG",
  };

  const result = await ingestActivityBatch(
    device,
    [mappedEvent, unmappedEvent],
    store,
  );

  assert.deepEqual(result, { accepted: 2 });
  assert.deepEqual(rows[0], {
    applicationName: "AutoCAD",
    companyId: "company-1",
    deviceId: "device-record-1",
    durationSeconds: 900,
    employeeId: "employee-1",
    endAt: mappedEvent.endAt,
    eventId: mappedEvent.eventId,
    fileName: mappedEvent.fileName,
    processName: null,
    projectId: "project-1",
    startAt: mappedEvent.startAt,
    taskId: "task-1",
    type: "APPLICATION",
    windowTitle: null,
  });
  assert.equal(rows[1]?.projectId, null);
  assert.equal(rows[1]?.taskId, null);
});

test("retrying an event ID does not create a second activity", async () => {
  const { rows, store } = createStore();

  await ingestActivityBatch(device, [mappedEvent], store);
  await ingestActivityBatch(device, [mappedEvent], store);

  assert.equal(rows.length, 1);
});

test("ingestion persists a queued backlog with one bulk activity write", async () => {
  let individualWrites = 0;
  const bulkWrites: Array<Array<Record<string, unknown>>> = [];
  const backlog = Array.from({ length: 100 }, (_, index) => ({
    ...mappedEvent,
    eventId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    fileName: null,
  }));
  const store = {
    async createActivity() {
      individualWrites += 1;
      return "created" as const;
    },
    async createActivities(data: Array<Record<string, unknown>>) {
      bulkWrites.push(data);
      return { created: data.length };
    },
    async findFileMapping() {
      return null;
    },
  };

  const result = await ingestActivityBatch(device, backlog, store);

  assert.deepEqual(result, { accepted: 100 });
  assert.equal(individualWrites, 0);
  assert.equal(bulkWrites.length, 1);
  assert.equal(bulkWrites[0]?.length, 100);
});

test("ingestion looks up a repeated drawing mapping once per batch", async () => {
  let mappingLookups = 0;
  const rows: Array<Record<string, unknown>> = [];
  const repeatedDrawing = Array.from({ length: 100 }, (_, index) => ({
    ...mappedEvent,
    eventId: `00000000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`,
  }));
  const store = {
    async createActivity(data: Record<string, unknown>) {
      rows.push(data);
      return "created" as const;
    },
    async findFileMapping() {
      mappingLookups += 1;
      return { projectId: "project-1", taskId: "task-1" };
    },
  };

  await ingestActivityBatch(device, repeatedDrawing, store);

  assert.equal(mappingLookups, 1);
  assert.equal(rows.length, 100);
  assert.equal(rows[99]?.projectId, "project-1");
});

test("the Prisma adapter treats duplicate event IDs as a conflict-safe no-op", async () => {
  const capture: {
    request: { data: unknown[]; skipDuplicates: boolean } | null;
  } = { request: null };
  const store = createConflictSafeActivityStore({
    activity: {
      async createMany(input) {
        capture.request = input;
        return { count: 0 };
      },
    },
    fileMapping: {
      async findUnique() {
        return null;
      },
    },
  });

  const result = await store.createActivity({
    applicationName: null,
    companyId: "company-1",
    deviceId: "device-record-1",
    durationSeconds: 1,
    employeeId: "employee-1",
    endAt: new Date("2026-09-01T09:00:01.000Z"),
    eventId: "5f277e32-f602-4bf2-8772-5ce109604bc8",
    fileName: null,
    processName: null,
    projectId: null,
    startAt: new Date("2026-09-01T09:00:00.000Z"),
    taskId: null,
    type: "APPLICATION",
    windowTitle: null,
  });

  assert.equal(result, "duplicate");
  assert.equal(capture.request?.skipDuplicates, true);
  assert.equal(capture.request?.data.length, 1);
});

test("ingestion rejects non-positive and over-six-hour durations", async () => {
  const { store } = createStore();
  const tooLong = {
    ...mappedEvent,
    endAt: new Date("2026-09-01T15:01:00.000Z"),
  };

  await assert.rejects(
    () => ingestActivityBatch(device, [tooLong], store),
    (error) => error instanceof ApiError && error.code === "VALIDATION_ERROR",
  );
});

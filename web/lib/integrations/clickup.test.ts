import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { encryptJson } from "@/lib/crypto/secret";
import type { ClickUpTask } from "@/lib/integrations/clickup/client";
import { ClickUpClient } from "@/lib/integrations/clickup/client";
import {
  mapClickUpPriorityToWorkLens,
  mapClickUpStatusToWorkLens,
  mapWorkLensStatusToClickUp,
  syncClickUpInbound,
  syncTaskToClickUp,
  type ClickUpSyncDatabase,
} from "@/lib/integrations/clickup/sync";
import {
  processClickUpWebhook,
  verifyClickUpWebhookSignature,
} from "@/lib/integrations/clickup/webhook";
import type {
  IntegrationMappingRecord,
  IntegrationRecord,
} from "@/lib/services/integrations";
import type { TaskPriority, TaskStatus } from "@/src/generated/prisma/client";

const managerA: AuthContext = {
  companyId: "comp-a",
  userId: "mgr-a",
  employeeId: "emp-a",
  role: "MANAGER",
};

const managerB: AuthContext = {
  companyId: "comp-b",
  userId: "mgr-b",
  employeeId: "emp-b",
  role: "MANAGER",
};

function createMockClickUpDatabase() {
  const integrations = new Map<string, IntegrationRecord>();
  const mappings = new Map<string, IntegrationMappingRecord>();
  const tasks = new Map<
    string,
    {
      id: string;
      companyId: string;
      projectId: string;
      title: string;
      description?: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate?: Date | null;
      estimatedMinutes?: number | null;
      createdById: string;
      updatedAt: Date;
    }
  >();
  const employees = new Map<string, { id: string; email: string; companyId: string }>();
  const assignments = new Set<string>();

  const db: ClickUpSyncDatabase = {
    async findIntegration(companyId) {
      return integrations.get(companyId) ?? null;
    },
    async findMapping(companyId, externalType, externalId) {
      return mappings.get(`${companyId}:${externalType}:${externalId}`) ?? null;
    },
    async findMappingByInternal(companyId, internalType, internalId) {
      for (const m of mappings.values()) {
        if (
          m.companyId === companyId &&
          m.internalEntityType === internalType &&
          m.internalId === internalId
        ) {
          return m;
        }
      }
      return null;
    },
    async upsertMapping(companyId, externalType, externalId, internalType, internalId, metadata) {
      const key = `${companyId}:${externalType}:${externalId}`;
      const record: IntegrationMappingRecord = {
        id: `map-${mappings.size + 1}`,
        companyId,
        provider: "CLICKUP",
        externalEntityType: externalType,
        externalId,
        internalEntityType: internalType,
        internalId,
        metadata: (metadata as any) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mappings.set(key, record);
      return record;
    },
    async findDefaultProject(companyId) {
      return { id: `proj-${companyId}` };
    },
    async createDefaultProject(companyId) {
      return { id: `proj-${companyId}` };
    },
    async findTask(companyId, taskId) {
      const t = tasks.get(taskId);
      if (!t || t.companyId !== companyId) return null;
      return {
        id: t.id,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        dueDate: t.dueDate ?? null,
        estimatedMinutes: t.estimatedMinutes ?? null,
        updatedAt: t.updatedAt,
      };
    },
    async createTask(data) {
      const id = `task-${tasks.size + 1}`;
      tasks.set(id, {
        ...data,
        id,
        updatedAt: new Date(),
      });
      return { id };
    },
    async updateTask(taskId, data) {
      const existing = tasks.get(taskId);
      if (!existing) throw new Error("Task not found");
      tasks.set(taskId, {
        ...existing,
        ...data,
        updatedAt: new Date(),
      });
      return { id: taskId };
    },
    async findEmployeeByEmail(companyId, email) {
      for (const emp of employees.values()) {
        if (emp.companyId === companyId && emp.email.toLowerCase() === email.toLowerCase()) {
          return { id: emp.id };
        }
      }
      return null;
    },
    async assignTask(taskId, employeeId) {
      assignments.add(`${taskId}:${employeeId}`);
    },
    async getUserForSystem(companyId) {
      return { id: `admin-${companyId}` };
    },
  };

  return { db, integrations, mappings, tasks, employees, assignments };
}

test("ClickUp status and priority mapping works predictably and safely", () => {
  assert.equal(mapClickUpStatusToWorkLens("to do"), "TODO");
  assert.equal(mapClickUpStatusToWorkLens("open"), "TODO");
  assert.equal(mapClickUpStatusToWorkLens("in progress"), "IN_PROGRESS");
  assert.equal(mapClickUpStatusToWorkLens("blocked"), "BLOCKED");
  assert.equal(mapClickUpStatusToWorkLens("review"), "REVIEW");
  assert.equal(mapClickUpStatusToWorkLens("done"), "COMPLETED");
  assert.equal(mapClickUpStatusToWorkLens("closed"), "COMPLETED");
  assert.equal(mapClickUpStatusToWorkLens("cancelled"), "CANCELLED");

  // Unknown external statuses must default to TODO, NEVER silently marked COMPLETED
  assert.equal(mapClickUpStatusToWorkLens("something_custom"), "TODO");

  assert.equal(mapWorkLensStatusToClickUp("TODO"), "to do");
  assert.equal(mapWorkLensStatusToClickUp("COMPLETED"), "complete");

  assert.equal(mapClickUpPriorityToWorkLens("urgent"), "URGENT");
  assert.equal(mapClickUpPriorityToWorkLens("high"), "HIGH");
  assert.equal(mapClickUpPriorityToWorkLens("normal"), "MEDIUM");
  assert.equal(mapClickUpPriorityToWorkLens("low"), "LOW");
});

test("ClickUp webhook signature verification and tamper detection", () => {
  const secret = "whsec_test_secret_123456";
  const rawBody = JSON.stringify({ event: "taskCreated", task_id: "cu-task-99" });

  // Valid signature
  const crypto = require("node:crypto");
  const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.ok(verifyClickUpWebhookSignature(rawBody, validSignature, secret));
  assert.ok(!verifyClickUpWebhookSignature(rawBody, "invalid-sig", secret));
  assert.ok(!verifyClickUpWebhookSignature(rawBody + "tampered", validSignature, secret));
});

test("ClickUp inbound sync maps tasks, assignees, and handles duplicate idempotency", async () => {
  const { db, integrations, employees, tasks, assignments } = createMockClickUpDatabase();

  // Setup integration record for comp-a
  integrations.set("comp-a", {
    id: "integ-1",
    companyId: "comp-a",
    provider: "CLICKUP",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiToken: "pk_test_token" }),
    config: { listId: "list-123" },
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed an employee
  employees.set("emp-1", { id: "emp-1", email: "alice@acme.com", companyId: "comp-a" });

  const mockTasks: ClickUpTask[] = [
    {
      id: "cu-1",
      name: "Floor Plan CAD Review",
      description: "Review DWG layer hierarchy",
      status: { status: "in progress", type: "custom" },
      priority: { priority: "high" },
      due_date: "1725753600000",
      time_estimate: 7200000, // 2 hours = 120 minutes
      assignees: [{ id: 101, username: "Alice", email: "alice@acme.com" }],
    },
  ];

  // Mock ClickUp client
  const mockClient = {
    async getTasks() {
      return { tasks: mockTasks, lastPage: true };
    },
  } as unknown as ClickUpClient;

  // 1. Initial Inbound Sync
  const result1 = await syncClickUpInbound(managerA, {
    listId: "list-123",
    client: mockClient,
    db,
  });

  assert.equal(result1.tasksProcessed, 1);
  assert.equal(result1.tasksCreated, 1);
  assert.equal(result1.tasksUpdated, 0);
  assert.equal(result1.assigneesMapped, 1);
  assert.equal(tasks.size, 1);

  const createdTask = Array.from(tasks.values())[0];
  assert.equal(createdTask.title, "Floor Plan CAD Review");
  assert.equal(createdTask.status, "IN_PROGRESS");
  assert.equal(createdTask.priority, "HIGH");
  assert.equal(createdTask.estimatedMinutes, 120);
  assert.ok(assignments.has(`${createdTask.id}:emp-1`));

  // 2. Second Sync (Idempotent update, no duplicate internal tasks created!)
  mockTasks[0].status = { status: "complete", type: "closed" };
  const result2 = await syncClickUpInbound(managerA, {
    listId: "list-123",
    client: mockClient,
    db,
  });

  assert.equal(result2.tasksProcessed, 1);
  assert.equal(result2.tasksCreated, 0);
  assert.equal(result2.tasksUpdated, 1);
  assert.equal(tasks.size, 1); // strictly 1 task, no duplicate!
  assert.equal(tasks.get(createdTask.id)?.status, "COMPLETED");
});

test("ClickUp outbound sync prevents recursive synchronization loops", async () => {
  const { db, integrations, tasks } = createMockClickUpDatabase();

  integrations.set("comp-a", {
    id: "integ-1",
    companyId: "comp-a",
    provider: "CLICKUP",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiToken: "pk_test_token" }),
    config: { listId: "list-123", syncDirection: "BIDIRECTIONAL" },
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Task created from recent inbound sync (< 5 seconds ago)
  tasks.set("task-100", {
    id: "task-100",
    companyId: "comp-a",
    projectId: "proj-comp-a",
    title: "Test Task",
    status: "TODO",
    priority: "MEDIUM",
    createdById: "mgr-a",
    updatedAt: new Date(),
  });

  await db.upsertMapping("comp-a", "TASK", "cu-99", "Task", "task-100", {
    direction: "INBOUND",
    lastSyncedAt: new Date().toISOString(), // fresh inbound sync
  });

  let outboundCalled = false;
  const mockClient = {
    async updateTask() {
      outboundCalled = true;
      return {} as ClickUpTask;
    },
  } as unknown as ClickUpClient;

  const res = await syncTaskToClickUp(managerA, "task-100", {
    client: mockClient,
    db,
  });

  // Must skip to prevent recursive loop!
  assert.equal(res.skipped, true);
  assert.equal(outboundCalled, false);
});

test("ClickUp tenant isolation: Manager A cannot sync Company B ClickUp data", async () => {
  const { db, integrations } = createMockClickUpDatabase();

  integrations.set("comp-b", {
    id: "integ-b",
    companyId: "comp-b",
    provider: "CLICKUP",
    status: "CONNECTED",
    encryptedCredentials: encryptJson({ apiToken: "pk_test_b" }),
    config: { listId: "list-b" },
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Manager A trying to sync while belonging to comp-a (comp-a has no integration configured)
  await assert.rejects(
    async () => {
      await syncClickUpInbound(managerA, { db });
    },
    /ClickUp integration is not configured/
  );
});

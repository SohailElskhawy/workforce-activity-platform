import assert from "node:assert/strict";
import test from "node:test";

import { type AuditEntry, writeAudit } from "@/lib/audit/log";

test("writeAudit persists the complete entry through the active transaction", async () => {
  const entries: AuditEntry[] = [];
  const transaction = {
    auditLog: {
      async create({ data }: { data: AuditEntry }) {
        entries.push(data);
        return data;
      },
    },
  };

  await writeAudit(transaction, {
    companyId: "company-a",
    actorUserId: "manager-a",
    action: "TASK_CREATED",
    entityType: "Task",
    entityId: "task-a",
    metadata: { projectId: "project-a" },
  });

  assert.deepEqual(entries, [{
    companyId: "company-a",
    actorUserId: "manager-a",
    action: "TASK_CREATED",
    entityType: "Task",
    entityId: "task-a",
    metadata: { projectId: "project-a" },
  }]);
});

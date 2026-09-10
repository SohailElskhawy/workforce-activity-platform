import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import {
  createPositionWithStore,
  deletePositionWithStore,
  type PositionStore,
} from "@/lib/services/positions";

const manager: AuthContext = {
  companyId: "company-alpha",
  employeeId: "employee-manager",
  role: "MANAGER",
  userId: "user-manager",
};

const employee: AuthContext = {
  companyId: "company-alpha",
  employeeId: "employee-staff",
  role: "EMPLOYEE",
  userId: "user-staff",
};

function createStore(seed?: {
  positions?: Array<{ companyId: string; id: string; name: string }>;
  assignedPositionIds?: string[];
}) {
  const positions = [...(seed?.positions ?? [])];
  const assigned = new Set(seed?.assignedPositionIds ?? []);
  const audits: Array<{ action: string; entityId: string }> = [];

  const store: PositionStore = {
    async listPositions(companyId) {
      return positions.filter((position) => position.companyId === companyId);
    },
    async findPositionById(id, companyId) {
      return positions.find((position) => position.id === id && position.companyId === companyId) ?? null;
    },
    async findPositionByName(name, companyId) {
      return positions.find(
        (position) => position.companyId === companyId && position.name.toLowerCase() === name.toLowerCase(),
      ) ?? null;
    },
    async createPosition(data) {
      const position = { id: `position-${positions.length + 1}`, ...data };
      positions.push(position);
      return position;
    },
    async hasAssignedEmployees(positionId) {
      return assigned.has(positionId);
    },
    async deletePosition(positionId) {
      const index = positions.findIndex((position) => position.id === positionId);
      if (index !== -1) positions.splice(index, 1);
    },
    async writeAudit(entry) {
      audits.push({ action: entry.action, entityId: entry.entityId });
    },
  };

  return { audits, positions, store };
}

test("manager creates a company position and receives an audit record", async () => {
  const { audits, positions, store } = createStore();

  const created = await createPositionWithStore(manager, { name: "Architect" }, store);

  assert.equal(created.companyId, "company-alpha");
  assert.equal(created.name, "Architect");
  assert.equal(positions.length, 1);
  assert.deepEqual(audits, [{ action: "POSITION_CREATED", entityId: created.id }]);
});

test("position management rejects employee callers and duplicate company names", async () => {
  const { store } = createStore({
    positions: [{ id: "position-1", companyId: "company-alpha", name: "Architect" }],
  });

  await assert.rejects(
    () => createPositionWithStore(employee, { name: "Architect" }, store),
    (error: unknown) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
  await assert.rejects(
    () => createPositionWithStore(manager, { name: "architect" }, store),
    (error: unknown) => error instanceof ApiError && error.code === "CONFLICT",
  );
});

test("position deletion is tenant-scoped and cannot orphan assigned employees", async () => {
  const { audits, positions, store } = createStore({
    assignedPositionIds: ["position-1"],
    positions: [
      { id: "position-1", companyId: "company-alpha", name: "Architect" },
      { id: "position-foreign", companyId: "company-beta", name: "Architect" },
    ],
  });

  await assert.rejects(
    () => deletePositionWithStore(manager, "position-foreign", store),
    (error: unknown) => error instanceof ApiError && error.code === "NOT_FOUND",
  );
  await assert.rejects(
    () => deletePositionWithStore(manager, "position-1", store),
    (error: unknown) => error instanceof ApiError && error.code === "CONFLICT",
  );

  const unassigned = createStore({
    positions: [{ id: "position-2", companyId: "company-alpha", name: "Planner" }],
  });
  await deletePositionWithStore(manager, "position-2", unassigned.store);
  assert.equal(unassigned.positions.length, 0);
  assert.deepEqual(unassigned.audits, [{ action: "POSITION_DELETED", entityId: "position-2" }]);
  assert.equal(positions.length, 2);
  assert.equal(audits.length, 0);
});

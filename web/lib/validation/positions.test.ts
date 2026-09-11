import assert from "node:assert/strict";
import test from "node:test";

import {
  createPositionSchema,
  employeePositionIdSchema,
} from "@/lib/validation/positions";

test("position validation normalizes a company position name and rejects blank names", () => {
  assert.equal(
    createPositionSchema.parse({ name: "  Electrical Engineer  " }).name,
    "Electrical Engineer",
  );
  assert.equal(createPositionSchema.safeParse({ name: "   " }).success, false);
  assert.equal(createPositionSchema.safeParse({ name: "A".repeat(161) }).success, false);
});

test("employee position validation accepts an unassigned value and rejects invalid IDs", () => {
  assert.equal(employeePositionIdSchema.parse({ positionId: "" }).positionId, null);
  assert.equal(employeePositionIdSchema.parse({ positionId: null }).positionId, null);
  assert.equal(
    employeePositionIdSchema.parse({
      positionId: "11111111-1111-4111-8111-111111111111",
    }).positionId,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(
    employeePositionIdSchema.parse({
      positionId: "legacy-position-a5dd5b4c51465a99567d2e545310ab33",
    }).positionId,
    "legacy-position-a5dd5b4c51465a99567d2e545310ab33",
  );
  assert.equal(
    employeePositionIdSchema.safeParse({ positionId: "foreign-position" }).success,
    false,
  );
});


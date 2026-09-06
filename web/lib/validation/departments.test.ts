import assert from "node:assert/strict";
import test from "node:test";

import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "@/lib/validation/departments";

test("createDepartmentSchema requires non-empty name and bounds length", () => {
  const valid = createDepartmentSchema.parse({
    name: "  Electrical Engineering  ",
  });
  assert.equal(valid.name, "Electrical Engineering");
  assert.equal(valid.managerId, null);

  const empty = createDepartmentSchema.safeParse({
    name: "   ",
  });
  assert.equal(empty.success, false);

  const tooLong = createDepartmentSchema.safeParse({
    name: "A".repeat(101),
  });
  assert.equal(tooLong.success, false);
});

test("createDepartmentSchema validates managerId UUID and transforms empty string", () => {
  const managerId = "11111111-1111-4111-8111-111111111111";
  const valid = createDepartmentSchema.parse({
    name: "Mechanical Design",
    managerId,
  });
  assert.equal(valid.managerId, managerId);

  const emptyManager = createDepartmentSchema.parse({
    name: "Mechanical Design",
    managerId: "",
  });
  assert.equal(emptyManager.managerId, null);

  const invalidManager = createDepartmentSchema.safeParse({
    name: "Mechanical Design",
    managerId: "not-a-uuid",
  });
  assert.equal(invalidManager.success, false);
});

test("updateDepartmentSchema allows partial updates and unassigning manager", () => {
  const partialName = updateDepartmentSchema.parse({
    name: "New Name",
  });
  assert.equal(partialName.name, "New Name");
  assert.equal(partialName.managerId, undefined);

  const unassignManager = updateDepartmentSchema.parse({
    managerId: null,
  });
  assert.equal(unassignManager.managerId, null);
  assert.equal(unassignManager.name, undefined);

  const emptyManagerString = updateDepartmentSchema.parse({
    managerId: "",
  });
  assert.equal(emptyManagerString.managerId, null);
});

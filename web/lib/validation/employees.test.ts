import assert from "node:assert/strict";
import test from "node:test";

import { createEmployeeSchema } from "@/lib/validation/employees";

test("createEmployeeSchema rejects a temporary password shorter than eight characters", () => {
  const result = createEmployeeSchema.safeParse({
    email: "ada@example.test",
    firstName: "Ada",
    lastName: "Lovelace",
    temporaryPassword: "short",
  });

  assert.equal(result.success, false);
});

test("createEmployeeSchema normalizes a work email and accepts optional fields", () => {
  const result = createEmployeeSchema.safeParse({
    departmentId: null,
    email: " ADA@EXAMPLE.TEST ",
    firstName: " Ada ",
    lastName: " Lovelace ",
    positionId: "11111111-1111-4111-8111-111111111111",
    temporaryPassword: "Temporary1!",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, "ada@example.test");
    assert.equal(result.data.positionId, "11111111-1111-4111-8111-111111111111");
  }
});

test("createEmployeeSchema accepts empty string for departmentId and positionId and transforms them to null", () => {
  const result = createEmployeeSchema.safeParse({
    departmentId: "",
    email: "ada@example.test",
    firstName: "Ada",
    lastName: "Lovelace",
    positionId: "",
    temporaryPassword: "Temporary1!",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.departmentId, null);
    assert.equal(result.data.positionId, null);
  }
});


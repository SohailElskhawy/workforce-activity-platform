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
    position: " Analyst ",
    temporaryPassword: "Temporary1!",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, "ada@example.test");
    assert.equal(result.data.position, "Analyst");
  }
});

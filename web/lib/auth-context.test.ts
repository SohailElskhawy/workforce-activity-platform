import assert from "node:assert/strict";
import test from "node:test";

import { assertRole, tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";

test("assertRole rejects disallowed roles with a forbidden error", () => {
  assert.throws(
    () => assertRole({ role: "EMPLOYEE" }, ["MANAGER"]),
    (error) => error instanceof ApiError && error.code === "FORBIDDEN" && error.status === 403,
  );
});

test("assertRole permits an allowed role", () => {
  assert.doesNotThrow(() => assertRole({ role: "MANAGER" }, ["MANAGER"]));
});

test("tenantWhere always writes the authenticated company scope", () => {
  assert.deepEqual(tenantWhere("company-a", { id: "employee-1", companyId: "untrusted" }), {
    id: "employee-1",
    companyId: "company-a",
  });
});

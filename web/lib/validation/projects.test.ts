import assert from "node:assert/strict";
import test from "node:test";

import { createProjectSchema } from "@/lib/validation/projects";

test("createProjectSchema rejects an end date before the start date", () => {
  const result = createProjectSchema.safeParse({
    code: "ABC-ELE",
    endDate: "2026-09-01",
    name: "ABC Electrical Project",
    startDate: "2026-09-02",
  });

  assert.equal(result.success, false);
});

test("createProjectSchema normalizes project codes", () => {
  const result = createProjectSchema.safeParse({ code: "abc-ele", name: "ABC Electrical Project" });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.code, "ABC-ELE");
});

import assert from "node:assert/strict";
import test from "node:test";

import { fail, handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";

test("ok wraps successful API data", async () => {
  const response = ok({ id: "project-1" }, { status: 201 });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { data: { id: "project-1" } });
});

test("fail serializes known API errors", async () => {
  const response = fail(new ApiError("NOT_FOUND", "Project not found.", 404));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "NOT_FOUND", message: "Project not found." },
  });
});

test("handleRouteError hides unexpected errors", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  let response: Response;
  try {
    response = handleRouteError(new Error("database connection string"));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
});

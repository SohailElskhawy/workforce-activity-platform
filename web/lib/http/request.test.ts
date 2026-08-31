import assert from "node:assert/strict";
import test from "node:test";

import { assertSameOrigin } from "@/lib/http/request";
import { ApiError } from "@/lib/http/errors";

test("assertSameOrigin permits same-origin mutations", () => {
  const request = new Request("https://worklens.demo/api/projects", {
    headers: { origin: "https://worklens.demo" },
    method: "POST",
  });

  assert.doesNotThrow(() => assertSameOrigin(request));
});

test("assertSameOrigin rejects cross-origin mutations", () => {
  const request = new Request("https://worklens.demo/api/projects", {
    headers: { origin: "https://attacker.example" },
    method: "POST",
  });

  assert.throws(
    () => assertSameOrigin(request),
    (error) => error instanceof ApiError && error.code === "FORBIDDEN",
  );
});

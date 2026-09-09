import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_ACCOUNTS, isDemoModeEnabled } from "./config";

test("demo mode requires the literal true flag", () => {
  assert.equal(isDemoModeEnabled({}), false);
  assert.equal(isDemoModeEnabled({ DEMO_MODE: "TRUE" }), false);
  assert.equal(isDemoModeEnabled({ DEMO_MODE: "true" }), true);
});

test("demo accounts provide one unique account per supported role", () => {
  assert.deepEqual(
    DEMO_ACCOUNTS.map((account) => account.role),
    ["SUPER_ADMIN", "MANAGER", "EMPLOYEE"],
  );
  assert.equal(new Set(DEMO_ACCOUNTS.map((account) => account.email)).size, 3);
});

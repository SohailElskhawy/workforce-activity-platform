import assert from "node:assert/strict";
import test from "node:test";

import {
  isRegisteredDevice,
  toEnrollmentCredentials,
} from "@/lib/agent/device-registration";

test("toEnrollmentCredentials preserves the one-time device credentials for employee enrollment", () => {
  const credentials = toEnrollmentCredentials({
    deviceId: "PC-AB12CD34",
    token: "worklens_agent_issued-token",
  });

  assert.deepEqual(credentials, {
    deviceId: "PC-AB12CD34",
    token: "worklens_agent_issued-token",
  });
});

test("isRegisteredDevice rejects a malformed registration response before it can reveal credentials", () => {
  assert.equal(isRegisteredDevice({ deviceId: "PC-AB12CD34" }), false);
  assert.equal(
    isRegisteredDevice({ token: "worklens_agent_issued-token" }),
    false,
  );
  assert.equal(isRegisteredDevice(null), false);
});

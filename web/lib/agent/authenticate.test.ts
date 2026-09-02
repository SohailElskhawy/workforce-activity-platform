import assert from "node:assert/strict";
import test from "node:test";

process.env.AGENT_TOKEN_PEPPER = "test-agent-token-pepper";

import { authenticateDevice } from "@/lib/agent/authenticate";
import { hashAgentToken } from "@/lib/agent/token";
import { ApiError } from "@/lib/http/errors";

const trustedDevice = {
  agentTokenHash: hashAgentToken("worklens_agent_valid"),
  companyId: "company-1",
  deviceId: "PC-TEST-001",
  employeeId: "employee-1",
  id: "device-record-1",
  isActive: true,
};

function request(headers: HeadersInit = {}) {
  return new Request("http://example.test/api/agent/heartbeat", { headers });
}

test("authenticateDevice returns only trusted device identity for valid credentials", async () => {
  const device = await authenticateDevice(
    request({
      Authorization: "Bearer worklens_agent_valid",
      "X-Device-ID": "PC-TEST-001",
    }),
    async () => trustedDevice,
  );

  assert.deepEqual(device, {
    companyId: "company-1",
    databaseId: "device-record-1",
    employeeId: "employee-1",
    publicId: "PC-TEST-001",
  });
});

test("authenticateDevice rejects missing, inactive, and invalid credentials alike", async () => {
  for (const [agentRequest, lookup] of [
    [request(), async () => trustedDevice],
    [
      request({ Authorization: "Bearer wrong", "X-Device-ID": "PC-TEST-001" }),
      async () => trustedDevice,
    ],
    [
      request({
        Authorization: "Bearer worklens_agent_valid",
        "X-Device-ID": "PC-TEST-001",
      }),
      async () => ({ ...trustedDevice, isActive: false }),
    ],
  ] as const) {
    await assert.rejects(
      () => authenticateDevice(agentRequest, lookup),
      (error) => error instanceof ApiError && error.code === "UNAUTHORIZED",
    );
  }
});

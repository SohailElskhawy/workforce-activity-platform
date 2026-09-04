import assert from "node:assert/strict";
import test from "node:test";

process.env.AGENT_TOKEN_PEPPER = "test-agent-token-pepper";

import { createAgentToken, hashAgentToken } from "@/lib/agent/token";

test("createAgentToken creates independent prefixed secrets", () => {
  const first = createAgentToken();
  const second = createAgentToken();

  assert.match(first, /^worklens_agent_/);
  assert.notEqual(first, second);
});

test("hashAgentToken is deterministic and distinguishes secrets", () => {
  const first = createAgentToken();
  const second = createAgentToken();

  assert.equal(hashAgentToken(first), hashAgentToken(first));
  assert.notEqual(hashAgentToken(first), hashAgentToken(second));
  assert.equal(hashAgentToken(first).length, 64);
});

test("hashAgentToken fails fast if AGENT_TOKEN_PEPPER is missing", () => {
  const original = process.env.AGENT_TOKEN_PEPPER;
  delete process.env.AGENT_TOKEN_PEPPER;
  try {
    assert.throws(
      () => hashAgentToken("some-token", undefined),
      /AGENT_TOKEN_PEPPER must be set/
    );
  } finally {
    process.env.AGENT_TOKEN_PEPPER = original;
  }
});

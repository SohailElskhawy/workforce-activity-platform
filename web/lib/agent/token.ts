import { createHmac, randomBytes } from "node:crypto";

export function createAgentToken() {
  return `worklens_agent_${randomBytes(32).toString("base64url")}`;
}

export function hashAgentToken(
  rawToken: string,
  pepper = process.env.AGENT_TOKEN_PEPPER,
) {
  if (!pepper) {
    throw new Error("AGENT_TOKEN_PEPPER must be set.");
  }

  return createHmac("sha256", pepper).update(rawToken).digest("hex");
}


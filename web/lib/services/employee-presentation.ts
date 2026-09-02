export type AgentConnectionStatus = "NOT_ENROLLED" | "OFFLINE" | "ONLINE";

export function getAgentConnectionStatus(
  lastSeenAt: Date | null,
  now = new Date(),
): AgentConnectionStatus {
  if (!lastSeenAt) return "NOT_ENROLLED";
  return lastSeenAt.getTime() >= now.getTime() - 90_000 ? "ONLINE" : "OFFLINE";
}

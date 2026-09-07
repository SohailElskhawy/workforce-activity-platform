import { assertRole, type AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";

export async function resolveSuperAdmin(
  context: AuthContext | null,
  findUser: (id: string) => Promise<(AuthContext & { active: boolean }) | null>,
) {
  if (!context)
    throw new ApiError("UNAUTHORIZED", "Authentication is required.", 401);
  assertRole(context, ["SUPER_ADMIN"]);
  const current = await findUser(context.userId);
  if (
    !current ||
    !current.active ||
    current.role !== "SUPER_ADMIN" ||
    current.companyId !== context.companyId ||
    current.employeeId !== context.employeeId
  )
    throw new ApiError("UNAUTHORIZED", "Please sign in again.", 401);
  return current;
}

// Historical free-form strings may contain credentials under innocent keys.
// Only typed, known operational values are displayed; unknown metadata is omitted.
export function safeAuditMetadata(
  value: unknown,
): Record<string, number | boolean | string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, number | boolean | string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (
      ["previousCompanyId", "newCompanyId"].includes(key) &&
      typeof val === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        val,
      )
    )
      output[key] = val;
    if (
      [
        "idleThresholdSeconds",
        "configVersion",
        "durationMinutes",
        "durationSeconds",
        "count",
      ].includes(key) &&
      typeof val === "number" &&
      Number.isFinite(val)
    )
      output[key] = val;
    if (["isActive", "enabled"].includes(key) && typeof val === "boolean")
      output[key] = val;
    if (
      ["role", "previousRole", "newRole"].includes(key) &&
      typeof val === "string" &&
      ["MANAGER", "EMPLOYEE", "SUPER_ADMIN"].includes(val)
    )
      output[key] = val;
    if (
      ["status", "previousStatus", "newStatus"].includes(key) &&
      typeof val === "string" &&
      [
        "ACTIVE",
        "INACTIVE",
        "SUSPENDED",
        "PLANNED",
        "COMPLETED",
        "ARCHIVED",
        "ON_HOLD",
      ].includes(val)
    )
      output[key] = val;
  }
  return output;
}

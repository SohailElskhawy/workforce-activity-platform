import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";

export async function GET(request: Request) {
  try {
    const context = await requireManagerContext();
    const employeeId = new URL(request.url).searchParams.get("employeeId");
    if (!employeeId) throw new ApiError("VALIDATION_ERROR", "employeeId is required.", 400);
    return ok(await getEmployeeDaySummary(context, employeeId));
  } catch (error) {
    return handleRouteError(error);
  }
}

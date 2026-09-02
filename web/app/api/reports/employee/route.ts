import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { getEmployeeDaySummary } from "@/lib/services/activity-reports";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get("employeeId");
    if (!id)
      throw new ApiError("VALIDATION_ERROR", "employeeId is required.", 400);
    const dayParam = searchParams.get("day");
    const day = dayParam ? new Date(`${dayParam}T00:00:00.000Z`) : undefined;
    if (day && Number.isNaN(day.getTime()))
      throw new ApiError(
        "VALIDATION_ERROR",
        "day must be a valid ISO date.",
        400,
      );
    return ok(
      await getEmployeeDaySummary(await requireManagerContext(), id, day),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

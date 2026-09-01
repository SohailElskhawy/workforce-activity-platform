import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { getTaskActivitySummary } from "@/lib/services/activity-reports";
export async function GET(request: Request) { try { const id = new URL(request.url).searchParams.get("taskId"); if (!id) throw new ApiError("VALIDATION_ERROR", "taskId is required.", 400); return ok(await getTaskActivitySummary(await requireManagerContext(), id)); } catch (error) { return handleRouteError(error); } }

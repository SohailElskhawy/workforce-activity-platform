import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { getAutomaticClassification } from "@/lib/services/analytics-engine";

export async function GET(request: Request) {
  try {
    const context = await requireManagerContext();
    const { searchParams } = new URL(request.url);
    const periodDays = searchParams.get("periodDays")
      ? parseInt(searchParams.get("periodDays")!, 10)
      : 7;
    const employeeId = searchParams.get("employeeId") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;

    const classification = await getAutomaticClassification(context, {
      periodDays,
      employeeId,
      projectId,
    });
    return ok(classification);
  } catch (error) {
    return handleRouteError(error);
  }
}

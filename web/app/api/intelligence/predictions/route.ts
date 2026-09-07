import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { getProjectPredictions } from "@/lib/services/analytics-engine";

export async function GET(request: Request) {
  try {
    const context = await requireManagerContext();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;

    const predictions = await getProjectPredictions(context, { projectId });
    return ok(predictions);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { getWorkloadAnalysis } from "@/lib/services/analytics-engine";

export async function GET(request: Request) {
  try {
    const context = await requireManagerContext();
    const { searchParams } = new URL(request.url);
    const periodDays = searchParams.get("periodDays")
      ? parseInt(searchParams.get("periodDays")!, 10)
      : 7;
    const departmentId = searchParams.get("departmentId") ?? undefined;

    const workload = await getWorkloadAnalysis(context, {
      periodDays,
      departmentId,
    });
    return ok(workload);
  } catch (error) {
    return handleRouteError(error);
  }
}

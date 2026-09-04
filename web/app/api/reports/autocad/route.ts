import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { getManagerDwgReport } from "@/lib/services/dwg-reports";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const day = searchParams.get("day");
    const employeeId = searchParams.get("employeeId") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    const context = await requireManagerContext();
    const report = await getManagerDwgReport(context, {
      day,
      employeeId,
      projectId,
    });
    return ok(report);
  } catch (error) {
    return handleRouteError(error);
  }
}

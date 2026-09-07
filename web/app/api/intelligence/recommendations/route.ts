import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { getManagementRecommendations } from "@/lib/services/analytics-engine";

export async function GET() {
  try {
    const context = await requireManagerContext();
    const recommendations = await getManagementRecommendations(context);
    return ok({ recommendations });
  } catch (error) {
    return handleRouteError(error);
  }
}

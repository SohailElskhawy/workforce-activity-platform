import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { listCompanyIntegrationsWithStore } from "@/lib/services/integrations";

export async function GET() {
  try {
    const context = await requireManagerContext();
    const integrations = await listCompanyIntegrationsWithStore(context);
    return ok(integrations);
  } catch (error) {
    return handleRouteError(error);
  }
}

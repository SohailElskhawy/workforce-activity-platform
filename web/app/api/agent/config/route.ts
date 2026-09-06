import { authenticateDevice } from "@/lib/agent/authenticate";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { getAgentConfig } from "@/lib/services/agent-config";

export async function GET(request: Request) {
  try {
    const device = await authenticateDevice(request);
    const config = await getAgentConfig(device);
    return ok(config);
  } catch (error) {
    return handleRouteError(error);
  }
}

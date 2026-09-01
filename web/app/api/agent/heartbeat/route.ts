import { authenticateDevice } from "@/lib/agent/authenticate";
import { heartbeatSchema } from "@/lib/agent/schemas";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { parseRequestBody } from "@/lib/http/request";
import { recordHeartbeat } from "@/lib/services/heartbeats";

export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);
    const input = await parseRequestBody(request, heartbeatSchema);
    return ok(await recordHeartbeat(device, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

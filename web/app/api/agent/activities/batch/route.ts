import { authenticateDevice } from "@/lib/agent/authenticate";
import { activityBatchSchema } from "@/lib/agent/schemas";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { parseRequestBody } from "@/lib/http/request";
import { ingestActivityBatch } from "@/lib/services/activities";

export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);
    const input = await parseRequestBody(request, activityBatchSchema);
    return ok(await ingestActivityBatch(device, input.activities));
  } catch (error) {
    return handleRouteError(error);
  }
}

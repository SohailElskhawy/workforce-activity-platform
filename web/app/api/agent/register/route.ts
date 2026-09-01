import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { registerDevice } from "@/lib/services/devices";
import { registerDeviceSchema } from "@/lib/validation/devices";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, registerDeviceSchema);
    return ok(await registerDevice(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

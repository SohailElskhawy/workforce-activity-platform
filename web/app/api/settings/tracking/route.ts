import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  getCompanyTrackingSettings,
  updateIdleThreshold,
} from "@/lib/services/tracking-settings";
import { updateTrackingSettingsSchema } from "@/lib/validation/tracking-settings";

export async function GET() {
  try {
    const context = await requireManagerContext();
    return ok(await getCompanyTrackingSettings(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, updateTrackingSettingsSchema);
    return ok(await updateIdleThreshold(context, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  addExcludedApplication,
  getCompanyTrackingSettings,
} from "@/lib/services/tracking-settings";
import { addExcludedApplicationSchema } from "@/lib/validation/tracking-settings";

export async function GET() {
  try {
    const context = await requireManagerContext();
    const data = await getCompanyTrackingSettings(context);
    return ok(data.excludedApplications);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, addExcludedApplicationSchema);
    return ok(await addExcludedApplication(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

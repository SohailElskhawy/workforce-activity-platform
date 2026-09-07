import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { configureIntegrationWithStore } from "@/lib/services/integrations";
import {
  clickUpConfigSchema,
  clockifyConfigSchema,
  integrationProviderSchema,
  kolayIkConfigSchema,
} from "@/lib/validation/integrations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const { provider } = await params;
    const validatedProvider = integrationProviderSchema.parse(
      provider.toUpperCase()
    );

    let credentials: Record<string, unknown> = {};
    let config: Record<string, unknown> = {};

    if (validatedProvider === "CLICKUP") {
      const body = await parseRequestBody(request, clickUpConfigSchema);
      credentials = {
        apiToken: body.apiToken,
        webhookSecret: body.webhookSecret,
      };
      config = {
        authType: body.authType,
        teamId: body.teamId,
        listId: body.listId,
        syncDirection: body.syncDirection,
      };
    } else if (validatedProvider === "CLOCKIFY") {
      const body = await parseRequestBody(request, clockifyConfigSchema);
      credentials = {
        apiKey: body.apiKey,
      };
      config = {
        workspaceId: body.workspaceId,
      };
    } else if (validatedProvider === "KOLAY_IK") {
      const body = await parseRequestBody(request, kolayIkConfigSchema);
      credentials = {
        apiToken: body.apiToken,
      };
      config = {
        apiBaseUrl: body.apiBaseUrl,
      };
    }

    const result = await configureIntegrationWithStore(
      context,
      validatedProvider,
      credentials,
      config
    );

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

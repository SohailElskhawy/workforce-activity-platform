import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin } from "@/lib/http/request";
import {
  disconnectIntegrationWithStore,
  getIntegrationWithStore,
} from "@/lib/services/integrations";
import { integrationProviderSchema } from "@/lib/validation/integrations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const context = await requireManagerContext();
    const { provider } = await params;
    const validatedProvider = integrationProviderSchema.parse(
      provider.toUpperCase()
    );
    const integration = await getIntegrationWithStore(
      context,
      validatedProvider
    );
    return ok(integration);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
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
    await disconnectIntegrationWithStore(context, validatedProvider);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

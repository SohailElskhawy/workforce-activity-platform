import { requireManagerContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit/log";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { ClickUpClient } from "@/lib/integrations/clickup/client";
import { ClockifyClient } from "@/lib/integrations/clockify/client";
import { KolayIkClient } from "@/lib/integrations/kolayik/client";
import { prisma } from "@/lib/prisma";
import { getDecryptedCredentialsWithStore } from "@/lib/services/integrations";
import { integrationProviderSchema } from "@/lib/validation/integrations";
import { z } from "zod";

const testPayloadSchema = z
  .object({
    apiToken: z.string().trim().optional(),
    apiKey: z.string().trim().optional(),
    apiBaseUrl: z.string().trim().optional(),
  })
  .optional();

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

    const body = await parseRequestBody(request, testPayloadSchema);

    let message = "";

    if (validatedProvider === "CLICKUP") {
      let token = body?.apiToken;
      if (!token) {
        const stored = await getDecryptedCredentialsWithStore<{ apiToken: string }>(
          context.companyId,
          "CLICKUP"
        );
        if (!stored?.credentials.apiToken) {
          throw new Error("No ClickUp API token found or provided");
        }
        token = stored.credentials.apiToken;
      }

      const client = new ClickUpClient({ apiToken: token });
      const res = await client.testConnection();
      message = `Connected as ${res.user.username} (${res.user.email})`;
    } else if (validatedProvider === "CLOCKIFY") {
      let key = body?.apiKey;
      if (!key) {
        const stored = await getDecryptedCredentialsWithStore<{ apiKey: string }>(
          context.companyId,
          "CLOCKIFY"
        );
        if (!stored?.credentials.apiKey) {
          throw new Error("No Clockify API key found or provided");
        }
        key = stored.credentials.apiKey;
      }

      const client = new ClockifyClient({ apiKey: key });
      const res = await client.testConnection();
      message = `Connected as ${res.user.name} (${res.user.email})`;
    } else if (validatedProvider === "KOLAY_IK") {
      let token = body?.apiToken;
      let baseUrl = body?.apiBaseUrl;
      if (!token) {
        const stored = await getDecryptedCredentialsWithStore<{ apiToken: string }>(
          context.companyId,
          "KOLAY_IK"
        );
        if (!stored?.credentials.apiToken) {
          throw new Error("No Kolay İK API token found or provided");
        }
        token = stored.credentials.apiToken;
        baseUrl = (stored.config?.apiBaseUrl as string) || undefined;
      }

      const client = new KolayIkClient({ apiToken: token, baseUrl });
      const res = await client.testConnection();
      message = res.message;
    }

    await writeAudit(prisma, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "INTEGRATION_CONNECTION_TESTED",
      entityType: "Integration",
      entityId: validatedProvider,
      metadata: {
        provider: validatedProvider,
        success: true,
      },
    });

    return ok({ success: true, message });
  } catch (error) {
    return handleRouteError(error);
  }
}

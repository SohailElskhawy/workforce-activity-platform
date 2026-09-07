import { processClickUpWebhook } from "@/lib/integrations/clickup/webhook";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let companyId = url.searchParams.get("companyId");

    const signature = request.headers.get("x-signature");
    const rawBody = await request.text();

    // If companyId is not in query params, find active ClickUp integration
    if (!companyId) {
      const integration = await prisma.integration.findFirst({
        where: {
          provider: "CLICKUP",
          status: "CONNECTED",
        },
        select: { companyId: true },
      });

      if (!integration) {
        return new Response(JSON.stringify({ error: "No active ClickUp integration found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      companyId = integration.companyId;
    }

    const result = await processClickUpWebhook(companyId, rawBody, signature);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    const status = message.includes("signature") ? 401 : 400;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

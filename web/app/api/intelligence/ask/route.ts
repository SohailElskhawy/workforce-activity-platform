import { z } from "zod";
import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { askManagementIntelligence } from "@/lib/services/analytics-engine";

const askSchema = z.object({
  question: z.string().trim().min(2).max(500),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const body = await parseRequestBody(request, askSchema);
    const answer = await askManagementIntelligence(context, body.question);
    return ok(answer);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { z } from "zod";
import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { ApiError } from "@/lib/http/errors";
import {
  getDwgMappingSuggestions,
  applyHighConfidenceDwgMatches,
  acceptDwgSuggestion,
} from "@/lib/services/dwg-matching-service";

const autoMatchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("apply-high-confidence"),
  }),
  z.object({
    action: z.literal("accept-suggestion"),
    fileName: z.string().min(1),
    projectId: z.string().uuid(),
    taskId: z.string().uuid().nullable().optional(),
  }),
]);

export async function GET() {
  try {
    const context = await requireManagerContext();
    const suggestions = await getDwgMappingSuggestions(context);
    return ok({ suggestions });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const body = await parseRequestBody(request, autoMatchActionSchema);

    if (body.action === "apply-high-confidence") {
      const result = await applyHighConfidenceDwgMatches(context);
      return ok(result);
    }

    if (body.action === "accept-suggestion") {
      const mapping = await acceptDwgSuggestion(context, {
        fileName: body.fileName,
        projectId: body.projectId,
        taskId: body.taskId,
      });
      return ok({ success: true, mapping });
    }

    throw new ApiError("VALIDATION_ERROR", "Unsupported action", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}

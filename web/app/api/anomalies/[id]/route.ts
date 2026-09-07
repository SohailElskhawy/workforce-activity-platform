import { z } from "zod";
import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { updateAnomalyReviewStatus } from "@/lib/services/anomaly-detection";

const updateStatusSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
  resolutionNotes: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const authContext = await requireManagerContext();
    const { id } = await context.params;
    const body = await parseRequestBody(request, updateStatusSchema);

    const updated = await updateAnomalyReviewStatus(authContext, id, body);
    return ok({ success: true, anomaly: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

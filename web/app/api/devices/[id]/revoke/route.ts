import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/request";
import { revokeDevice } from "@/lib/services/devices";

const deviceIdSchema = z.uuid("Device ID is invalid.");

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsedId = deviceIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Device ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const revoked = await revokeDevice(authContext, parsedId.data);
    return ok(revoked);
  } catch (error) {
    return handleRouteError(error);
  }
}

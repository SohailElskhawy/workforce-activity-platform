import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  removeExcludedApplication,
  updateExcludedApplication,
} from "@/lib/services/tracking-settings";
import { updateExcludedApplicationSchema } from "@/lib/validation/tracking-settings";

const exclusionIdSchema = z.string().uuid("Exclusion ID is invalid.");

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsedId = exclusionIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Exclusion ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const input = await parseRequestBody(
      request,
      updateExcludedApplicationSchema,
    );
    return ok(await updateExcludedApplication(authContext, parsedId.data, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsedId = exclusionIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Exclusion ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    return ok(await removeExcludedApplication(authContext, parsedId.data));
  } catch (error) {
    return handleRouteError(error);
  }
}

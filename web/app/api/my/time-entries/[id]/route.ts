import { z } from "zod";

import { requireEmployeeContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  deleteOwnTimeEntry,
  updateOwnTimeEntry,
} from "@/lib/services/time-entries";
import { updateTimeEntrySchema } from "@/lib/validation/time-entries";

const timeEntryIdSchema = z.uuid("Time entry ID is invalid.");

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsedId = timeEntryIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Time entry ID is invalid.",
        400,
      );
    }

    const authContext = await requireEmployeeContext();
    const input = await parseRequestBody(request, updateTimeEntrySchema);
    return ok(await updateOwnTimeEntry(authContext, parsedId.data, input));
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
    const parsedId = timeEntryIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Time entry ID is invalid.",
        400,
      );
    }

    const authContext = await requireEmployeeContext();
    return ok(await deleteOwnTimeEntry(authContext, parsedId.data));
  } catch (error) {
    return handleRouteError(error);
  }
}

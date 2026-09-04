import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { getTask, updateTask } from "@/lib/services/tasks";
import { updateTaskSchema } from "@/lib/validation/tasks";

const taskIdSchema = z.uuid("Task ID is invalid.");

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const parsedId = taskIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Task ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    return ok(await getTask(authContext, parsedId.data));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsedId = taskIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Task ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const input = await parseRequestBody(request, updateTaskSchema);
    return ok(await updateTask(authContext, parsedId.data, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

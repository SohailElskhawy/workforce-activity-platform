import { z } from "zod";

import { requireEmployeeContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { updateOwnAssignedTaskStatus } from "@/lib/services/employee-self";
import { updateOwnTaskStatusSchema } from "@/lib/validation/employee-tasks";

const taskIdSchema = z.uuid("Task ID is invalid.");

export async function PATCH(request: Request, context: RouteContext<"/api/my/tasks/[id]">) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const taskId = taskIdSchema.safeParse(id);
    if (!taskId.success) {
      throw new ApiError("VALIDATION_ERROR", taskId.error.issues[0]?.message ?? "Task ID is invalid.", 400);
    }

    const input = await parseRequestBody(request, updateOwnTaskStatusSchema);
    return ok(await updateOwnAssignedTaskStatus(await requireEmployeeContext(), taskId.data, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

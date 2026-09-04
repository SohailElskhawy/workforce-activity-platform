import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { getProject, updateProject } from "@/lib/services/projects";
import { updateProjectSchema } from "@/lib/validation/projects";

const projectIdSchema = z.uuid("Project ID is invalid.");

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const parsedId = projectIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Project ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    return ok(await getProject(authContext, parsedId.data));
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
    const parsedId = projectIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Project ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const input = await parseRequestBody(request, updateProjectSchema);
    return ok(await updateProject(authContext, parsedId.data, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

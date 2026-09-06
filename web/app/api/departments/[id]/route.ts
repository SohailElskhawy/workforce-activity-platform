import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  deleteDepartment,
  getDepartment,
  updateDepartment,
} from "@/lib/services/departments";
import { updateDepartmentSchema } from "@/lib/validation/departments";

const departmentIdSchema = z.string().uuid("Department ID is invalid.");

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const parsedId = departmentIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Department ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    return ok(await getDepartment(authContext, parsedId.data));
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
    const parsedId = departmentIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Department ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const input = await parseRequestBody(request, updateDepartmentSchema);
    return ok(await updateDepartment(authContext, parsedId.data, input));
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
    const parsedId = departmentIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Department ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    return ok(await deleteDepartment(authContext, parsedId.data));
  } catch (error) {
    return handleRouteError(error);
  }
}

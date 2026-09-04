import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { getEmployee, updateEmployee } from "@/lib/services/employees";
import { updateEmployeeSchema } from "@/lib/validation/employees";

const employeeIdSchema = z.uuid("Employee ID is invalid.");

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const parsedId = employeeIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Employee ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    return ok(await getEmployee(authContext, parsedId.data));
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
    const parsedId = employeeIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Employee ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const input = await parseRequestBody(request, updateEmployeeSchema);
    return ok(await updateEmployee(authContext, parsedId.data, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

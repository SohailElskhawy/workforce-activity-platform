import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  deleteEmployeeLeaveWithStore,
  updateEmployeeLeaveWithStore,
} from "@/lib/services/leaves";
import { updateEmployeeLeaveSchema } from "@/lib/validation/leaves";

const leaveIdSchema = z.uuid("Leave ID is invalid.");

async function readLeaveId(params: Promise<{ id: string }>) {
  const parsed = leaveIdSchema.safeParse((await params).id);
  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Leave ID is invalid.",
      400,
    );
  }
  return parsed.data;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const [leaveId, input] = await Promise.all([
      readLeaveId(params),
      parseRequestBody(request, updateEmployeeLeaveSchema),
    ]);
    return ok(await updateEmployeeLeaveWithStore(context, leaveId, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await deleteEmployeeLeaveWithStore(
      await requireManagerContext(),
      await readLeaveId(params),
    );
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

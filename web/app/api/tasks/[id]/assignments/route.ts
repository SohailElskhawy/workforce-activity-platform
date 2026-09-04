import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  assignEmployeeToTask,
  unassignEmployeeFromTask,
} from "@/lib/services/tasks";
import { assignEmployeeSchema } from "@/lib/validation/tasks";

const taskIdSchema = z.uuid("Task ID is invalid.");

export async function POST(
  request: Request,
  context: RouteContext<"/api/tasks/[id]/assignments">,
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const taskId = taskIdSchema.safeParse(id);
    if (!taskId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        taskId.error.issues[0]?.message ?? "Task ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    const input = await parseRequestBody(request, assignEmployeeSchema);
    return ok(await assignEmployeeToTask(authContext, taskId.data, input), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/tasks/[id]/assignments">,
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const taskId = taskIdSchema.safeParse(id);
    if (!taskId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        taskId.error.issues[0]?.message ?? "Task ID is invalid.",
        400,
      );
    }

    const authContext = await requireManagerContext();
    let employeeId: string | null = null;
    const url = new URL(request.url);
    const queryEmployeeId = url.searchParams.get("employeeId");
    if (queryEmployeeId) {
      employeeId = queryEmployeeId;
    } else {
      const body = (await request.json().catch(() => null)) as {
        employeeId?: unknown;
      } | null;
      if (body && typeof body === "object" && "employeeId" in body) {
        employeeId = String(body.employeeId);
      }
    }

    const parsedEmployeeId = z
      .string()
      .uuid("Employee ID is invalid.")
      .safeParse(employeeId);
    if (!parsedEmployeeId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedEmployeeId.error.issues[0]?.message ?? "Employee ID is invalid.",
        400,
      );
    }

    return ok(
      await unassignEmployeeFromTask(
        authContext,
        taskId.data,
        parsedEmployeeId.data,
      ),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}


import { z } from "zod";

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  createEmployeeLeaveWithStore,
  listEmployeeLeavesWithStore,
} from "@/lib/services/leaves";
import { createEmployeeLeaveSchema } from "@/lib/validation/leaves";

const optionalEmployeeIdSchema = z.string().uuid().optional();

export async function GET(request: Request) {
  try {
    const employeeId = optionalEmployeeIdSchema.parse(
      new URL(request.url).searchParams.get("employeeId") ?? undefined,
    );
    return ok(
      await listEmployeeLeavesWithStore(await requireManagerContext(), undefined, employeeId),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, createEmployeeLeaveSchema);
    return ok(await createEmployeeLeaveWithStore(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { createEmployee } from "@/lib/services/employees";
import { createEmployeeSchema } from "@/lib/validation/employees";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, createEmployeeSchema);
    return ok(await createEmployee(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

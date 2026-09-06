import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  createDepartment,
  listDepartmentsWithDetails,
} from "@/lib/services/departments";
import { createDepartmentSchema } from "@/lib/validation/departments";

export async function GET() {
  try {
    const context = await requireManagerContext();
    return ok(await listDepartmentsWithDetails(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, createDepartmentSchema);
    return ok(await createDepartment(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

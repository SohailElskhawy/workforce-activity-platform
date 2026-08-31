import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { parseRequestBody } from "@/lib/http/request";
import { createTask, listTasks } from "@/lib/services/tasks";
import { createTaskSchema } from "@/lib/validation/tasks";

export async function GET() {
  try {
    const context = await requireManagerContext();
    return ok(await listTasks(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, createTaskSchema);
    return ok(await createTask(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

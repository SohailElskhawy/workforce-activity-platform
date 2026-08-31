import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { parseRequestBody } from "@/lib/http/request";
import { createProject, listProjects } from "@/lib/services/projects";
import { createProjectSchema } from "@/lib/validation/projects";

export async function GET() {
  try {
    const context = await requireManagerContext();
    return ok(await listProjects(context));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, createProjectSchema);
    return ok(await createProject(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

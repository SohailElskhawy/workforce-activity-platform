import { requireEmployeeContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  createOwnTimeEntry,
  listOwnTimeEntries,
} from "@/lib/services/time-entries";
import { createTimeEntrySchema } from "@/lib/validation/time-entries";

export async function GET() {
  try {
    return ok(await listOwnTimeEntries(await requireEmployeeContext()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseRequestBody(request, createTimeEntrySchema);
    return ok(await createOwnTimeEntry(await requireEmployeeContext(), input), {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  createPositionWithStore,
  listPositionsWithStore,
} from "@/lib/services/positions";
import { createPositionSchema } from "@/lib/validation/positions";

export async function GET() {
  try {
    return ok(await listPositionsWithStore(await requireManagerContext()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const input = await parseRequestBody(request, createPositionSchema);
    return ok(await createPositionWithStore(context, input), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

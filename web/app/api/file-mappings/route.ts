import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import { upsertFileMapping } from "@/lib/services/file-mappings";
import { fileMappingSchema } from "@/lib/validation/file-mappings";

export async function POST(request: Request) {
  try { assertSameOrigin(request); return ok(await upsertFileMapping(await requireManagerContext(), await parseRequestBody(request, fileMappingSchema))); }
  catch (error) { return handleRouteError(error); }
}

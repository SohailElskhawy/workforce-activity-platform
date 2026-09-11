import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { assertSameOrigin } from "@/lib/http/request";
import { deletePositionWithStore } from "@/lib/services/positions";
import { positionIdSchema } from "@/lib/validation/positions";


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const parsedId = positionIdSchema.safeParse((await params).id);
    if (!parsedId.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedId.error.issues[0]?.message ?? "Position ID is invalid.",
        400,
      );
    }
    await deletePositionWithStore(await requireManagerContext(), parsedId.data);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

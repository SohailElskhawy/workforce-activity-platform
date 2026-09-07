import { getAuthSession, toAuthContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import { getTaskNotifications } from "@/lib/services/notifications";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      throw new ApiError("UNAUTHORIZED", "Authentication is required.", 401);
    }
    const context = toAuthContext(session);
    const notifications = await getTaskNotifications(context);
    return ok({
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { assertRole, type AuthContext } from "@/lib/auth-context";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin } from "@/lib/http/request";

export type AdminRouteParams = { params: Promise<{ id?: string }> };
/** Shared boundary for explicit admin APIs, with injectable authentication for tests. */
export function adminHandler(
  authorize: () => Promise<AuthContext>,
  action: (
    context: AuthContext,
    request: Request,
    route: AdminRouteParams,
  ) => Promise<unknown> | unknown,
  options: { mutation?: boolean; status?: number } = {},
) {
  return async (request: Request, route: AdminRouteParams) => {
    try {
      if (options.mutation) assertSameOrigin(request);
      const context = await authorize();
      assertRole(context, ["SUPER_ADMIN"]);
      return ok(await action(context, request, route), {
        status: options.status ?? 200,
      });
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

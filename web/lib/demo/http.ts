import { ApiError } from "@/lib/http/errors";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin } from "@/lib/http/request";

import type { DemoFixtureResult } from "./fixtures";

export function createDemoPostHandler(
  enabled: () => boolean,
  operation: () => Promise<DemoFixtureResult>,
) {
  return async function postDemoData(request: Request) {
    try {
      if (!enabled()) {
        throw new ApiError("NOT_FOUND", "Demo mode is unavailable.", 404);
      }

      assertSameOrigin(request);
      return ok(await operation());
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

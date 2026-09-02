import type { z } from "zod";

import { ApiError } from "@/lib/http/errors";

/** Rejects cross-origin browser mutations before reading their request bodies. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  if (origin !== new URL(request.url).origin) {
    throw new ApiError(
      "FORBIDDEN",
      "Cross-origin requests are not allowed.",
      403,
    );
  }
}

export async function parseRequestBody<T extends z.ZodType>(
  request: Request,
  schema: T,
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Request body must be valid JSON.",
      400,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request.",
      400,
    );
  }

  return parsed.data;
}

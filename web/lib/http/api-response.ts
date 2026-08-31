import { ApiError, isApiError } from "@/lib/http/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json({ data }, { ...init, headers });
}

export function fail(error: ApiError) {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Converts only known failures to client responses and hides unexpected details. */
export function handleRouteError(error: unknown) {
  if (isApiError(error)) {
    return fail(error);
  }

  console.error("Unhandled API route error.");
  return fail(new ApiError("INTERNAL_ERROR", "Something went wrong.", 500));
}

export class ClientRequestError extends Error {}

type ErrorPayload = { error?: { message?: string } };

export async function sendJson<T>(
  url: string,
  method: "PATCH" | "POST",
  body: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    ({ data?: T } & ErrorPayload) | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new ClientRequestError(
      payload?.error?.message ?? "Unable to save your changes.",
    );
  }

  return payload.data;
}

export function postJson<T>(url: string, body: unknown) {
  return sendJson<T>(url, "POST", body);
}

export function patchJson<T>(url: string, body: unknown) {
  return sendJson<T>(url, "PATCH", body);
}

export async function deleteJson<T>(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    ({ data?: T } & ErrorPayload) | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new ClientRequestError(
      payload?.error?.message ?? "Unable to complete request.",
    );
  }

  return payload.data;
}

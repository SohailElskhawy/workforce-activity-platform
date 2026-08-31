export class ClientRequestError extends Error {}

type ErrorPayload = { error?: { message?: string } };

export async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as { data?: T } & ErrorPayload | null;
  if (!response.ok || !payload?.data) {
    throw new ClientRequestError(payload?.error?.message ?? "Unable to save your changes.");
  }

  return payload.data;
}

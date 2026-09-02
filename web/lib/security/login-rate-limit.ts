import "server-only";

import { createHash } from "node:crypto";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1_000;
const MAX_BUCKETS = 10_000;

type RateLimitBucket = { attempts: number; resetAt: number };

const globalForRateLimit = globalThis as typeof globalThis & {
  loginRateLimitBuckets?: Map<string, RateLimitBucket>;
};

const buckets =
  globalForRateLimit.loginRateLimitBuckets ??
  new Map<string, RateLimitBucket>();
globalForRateLimit.loginRateLimitBuckets = buckets;

function getHeader(headers: Record<string, unknown> | undefined, name: string) {
  const headerName = Object.keys(headers ?? {}).find(
    (key) => key.toLowerCase() === name,
  );
  const value = headerName ? headers?.[headerName] : undefined;
  return typeof value === "string" ? value : undefined;
}

function keyFor(email: string, headers: Record<string, unknown> | undefined) {
  const forwardedFor = getHeader(headers, "x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwardedFor || getHeader(headers, "x-real-ip") || "unknown";

  return createHash("sha256").update(`${address}:${email}`).digest("hex");
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Per-process fallback protection for credentials sign-in. Deployments with
 * multiple instances should enforce an equivalent shared edge/WAF rate limit.
 */
export function consumeLoginAttempt(
  email: string,
  headers?: Record<string, unknown>,
) {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = keyFor(email, headers);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.attempts >= MAX_ATTEMPTS) {
    return false;
  }

  bucket.attempts += 1;
  return true;
}

export function resetLoginAttempts(
  email: string,
  headers?: Record<string, unknown>,
) {
  buckets.delete(keyFor(email, headers));
}

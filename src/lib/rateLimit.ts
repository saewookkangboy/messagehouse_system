interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Single-process in-memory fixed-window limiter. Good enough for this app's
 * single-instance deployment; a horizontally-scaled deployment would need a
 * shared store (Redis) instead since this state doesn't cross processes.
 */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= opts.limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Test-only escape hatch to clear all buckets between runs. */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}

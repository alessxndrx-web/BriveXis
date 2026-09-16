/**
 * Fixed-window rate limiter, in memory.
 *
 * Sized for a single-process contact endpoint that receives a handful of
 * submissions a day. State lives in this process, so behind several instances
 * each one keeps its own count — acceptable for a spam brake, and the reason
 * no stronger claim is made about it. Moving to Redis is the change to make if
 * the site is ever scaled horizontally.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Returns false once the caller has spent its allowance for the window. */
  check(key: string): boolean;
}

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, Window>();

  return {
    check(key) {
      const now = Date.now();
      const current = windows.get(key);

      if (!current || now >= current.resetAt) {
        windows.set(key, { count: 1, resetAt: now + windowMs });

        // Expired entries are only dropped on access, so sweep occasionally to
        // stop the map growing without bound under scattered traffic.
        if (windows.size > 500) {
          for (const [existingKey, window] of windows) {
            if (now >= window.resetAt) windows.delete(existingKey);
          }
        }
        return true;
      }

      if (current.count >= limit) return false;

      current.count += 1;
      return true;
    },
  };
}

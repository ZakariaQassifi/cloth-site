/**
 * Fixed-window rate limiter.
 *
 * Dependency-free and in-process, matching the approach already used for admin
 * login throttling. It exists to blunt abuse rather than to enforce a quota:
 * a script that fires hundreds of checkout requests a minute should not be able
 * to fill the orders table or turn the store's mail sending into a spam relay.
 *
 * State resets on restart, which is acceptable for a single-process deployment.
 * A multi-instance deployment would move this to shared storage.
 */

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests permitted per window, per key. */
  max: number;
  /** Distinguishes one bucket from another in the shared registry. */
  bucket: string;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying; 0 when allowed. */
  retryAfterSeconds: number;
  /** Requests left in the current window. */
  remaining: number;
}

const registry = new Map<string, { count: number; resetAt: number }>();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (registry.size < 500) return;
  for (const [key, entry] of registry) {
    if (entry.resetAt <= now) registry.delete(key);
  }
}

/**
 * Consume one unit of quota for `key`.
 *
 * The counter is incremented before the decision is returned, so a caller that
 * is over the limit still consumes attempts and cannot reset the window by
 * asking politely.
 */
export function consumeRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const composite = `${options.bucket}:${key}`;
  const existing = registry.get(composite);

  if (!existing || existing.resetAt <= now) {
    registry.set(composite, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0, remaining: options.max - 1 };
  }

  existing.count += 1;
  if (existing.count > options.max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: options.max - existing.count };
}

/**
 * Express middleware form of {@link consumeRateLimit}.
 *
 * Identifies the caller by socket address. `trust proxy` is deliberately left off
 * in this server, so `req.ip` is the real peer and cannot be spoofed with a
 * forged `X-Forwarded-For` header to reset somebody else's quota.
 */
export function rateLimit(options: RateLimitOptions) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const result = consumeRateLimit(key, options);

    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (result.allowed) {
      next();
      return;
    }

    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({
      success: false,
      message: `Too many requests. Please try again in ${result.retryAfterSeconds} seconds.`,
    });
  };
}
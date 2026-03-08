import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  limit: number;
  /** Window duration in seconds */
  windowSecs: number;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check whether Upstash is configured. If not, rate limiting is a no-op
 * (logs a warning once so it's obvious in dev).
 */
const upstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let warnedOnce = false;

function getRedis(): Redis | null {
  if (!upstashConfigured) {
    if (!warnedOnce) {
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — rate limiting disabled"
      );
      warnedOnce = true;
    }
    return null;
  }
  return Redis.fromEnv();
}

// Cache Ratelimit instances by namespace+config so we don't recreate on every call
const limiters = new Map<string, Ratelimit>();

function getLimiter(namespace: string, config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${namespace}:${config.limit}:${config.windowSecs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSecs} s`),
      prefix: `rl:${namespace}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Rate-limit a request. Returns a 429 NextResponse if over the limit,
 * or null if the request is allowed.
 *
 * Drop-in replacement for the previous in-memory implementation.
 * When Upstash env vars are missing (local dev), rate limiting is skipped.
 */
export async function rateLimit(
  request: NextRequest,
  namespace: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const limiter = getLimiter(namespace, config);
  if (!limiter) return null; // Upstash not configured — allow

  const ip = getClientIp(request);
  const { success, reset } = await limiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(retryAfter, 1)) },
      }
    );
  }

  return null;
}

/**
 * Pre-configured rate limits:
 * - 10 new responses per minute per IP
 * - 60 answer submissions per minute per IP
 * - 5 new respondent IDs per IP per hour
 * - 120 admin API calls per minute per IP
 */
export const RATE_LIMITS = {
  createResponse: { limit: 10, windowSecs: 60 },
  submitAnswer: { limit: 60, windowSecs: 60 },
  createRespondent: { limit: 5, windowSecs: 3600 },
  adminApi: { limit: 120, windowSecs: 60 },
} as const satisfies Record<string, RateLimitConfig>;

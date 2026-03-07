import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter for development and single-instance deploys.
 * Replace with @upstash/ratelimit + Vercel KV for production multi-instance.
 */
const store = new Map<string, RateLimitEntry>();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

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

export function rateLimit(
  request: NextRequest,
  namespace: string,
  config: RateLimitConfig
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${namespace}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowSecs * 1000 });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return null;
}

/**
 * Pre-configured rate limits from the plan:
 * - 1 new response per minute per IP
 * - 60 answer submissions per minute per IP
 * - 5 new respondent IDs per IP per hour
 */
export const RATE_LIMITS = {
  createResponse: { limit: 1, windowSecs: 60 },
  submitAnswer: { limit: 60, windowSecs: 60 },
  createRespondent: { limit: 5, windowSecs: 3600 },
  adminApi: { limit: 120, windowSecs: 60 },
} as const satisfies Record<string, RateLimitConfig>;

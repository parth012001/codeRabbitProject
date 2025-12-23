/**
 * Simple in-memory rate limiter for MVP
 * Limits requests per user per minute
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
  /** Maximum requests per window per user */
  maxRequests: 60,
  /** Window duration in milliseconds (1 minute) */
  windowMs: 60 * 1000,
} as const;

/**
 * Check if a user has exceeded their rate limit
 * @param userId - The user ID to check
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
      resetIn: RATE_LIMIT_CONFIG.windowMs,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > RATE_LIMIT_CONFIG.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Create a rate limit response with proper headers
 */
export function createRateLimitResponse(resetIn: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Too many requests. Please try again later.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Limit': String(RATE_LIMIT_CONFIG.maxRequests),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

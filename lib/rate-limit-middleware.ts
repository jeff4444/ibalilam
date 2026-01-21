/**
 * Rate Limiting Middleware Helper
 * 
 * INFO-001 FIX: Provides rate limiting for API routes.
 * This module is designed to be used in API route handlers.
 * 
 * Usage in API routes:
 *   import { withRateLimit } from '@/lib/rate-limit-middleware'
 *   
 *   export async function POST(request: NextRequest) {
 *     const rateLimitResult = await withRateLimit(request, 'login')
 *     if (rateLimitResult) return rateLimitResult // Returns 429 response if limited
 *     
 *     // ... rest of handler
 *   }
 */
import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { rateLimiter, getClientIp, createIdentifier, getRateLimitHeaders, RateLimitCategory } from "./rate-limiter"
import { auditLog } from "./audit-logger"

/**
 * Rate limit check for API routes
 * Returns a 429 response if rate limited, or null if allowed
 */
export async function withRateLimit(
  request: NextRequest,
  category: RateLimitCategory,
  userId?: string
): Promise<NextResponse | null> {
  const ip = getClientIp(request)
  const identifier = createIdentifier(ip, userId)
  const config = rateLimiter.getDefaultConfig(category)
  const result = await rateLimiter.check(identifier, category)
  
  if (!result.allowed) {
    // Log rate limit hit
    await auditLog.security.rateLimitHit(identifier, request.nextUrl.pathname, request)
    
    const headers = getRateLimitHeaders(result, config)
    
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${headers['Retry-After']} seconds.`,
        retryAfter: parseInt(headers['Retry-After'] || '60'),
      },
      {
        status: 429,
        headers: {
          ...headers,
        },
      }
    )
  }
  
  return null
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  category: RateLimitCategory,
  userId?: string
): void {
  // This is a fire-and-forget operation to add headers
  // The actual rate limit check should be done with withRateLimit
  const ip = getClientIp(request)
  const identifier = createIdentifier(ip, userId)
  const config = rateLimiter.getDefaultConfig(category)
  
  rateLimiter.peek(identifier, category).then(result => {
    const headers = getRateLimitHeaders(result, config)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }).catch(() => {
    // Ignore errors in header addition
  })
}

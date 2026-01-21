/**
 * Rate Limiting Utility
 * 
 * INFO-001 FIX: Implements distributed rate limiting using Supabase as the backing store.
 * This provides consistent rate limiting across serverless function instances.
 * 
 * Usage:
 *   import { rateLimiter, RateLimitCategory } from '@/lib/rate-limiter'
 *   
 *   const result = await rateLimiter.check('192.168.1.1', 'login')
 *   if (!result.allowed) {
 *     return new Response('Too many requests', { status: 429 })
 *   }
 */
import "server-only"

import { supabaseAdmin } from "@/utils/supabase/admin"
import { NextRequest } from "next/server"

// ============================================================
// Types
// ============================================================

export type RateLimitCategory = 
  | 'login'
  | 'password_reset'
  | 'signup'
  | 'order_create'
  | 'api_general'
  | 'message_send'
  | 'file_upload'

export interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  currentCount: number
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'Retry-After'?: string
}

// ============================================================
// Default Rate Limit Configurations
// ============================================================

const DEFAULT_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  login: { maxRequests: 5, windowSeconds: 900 },           // 5 per 15 minutes
  password_reset: { maxRequests: 3, windowSeconds: 3600 }, // 3 per hour
  signup: { maxRequests: 3, windowSeconds: 3600 },         // 3 per hour
  order_create: { maxRequests: 10, windowSeconds: 3600 },  // 10 per hour
  api_general: { maxRequests: 100, windowSeconds: 60 },    // 100 per minute
  message_send: { maxRequests: 30, windowSeconds: 60 },    // 30 per minute
  file_upload: { maxRequests: 20, windowSeconds: 300 },    // 20 per 5 minutes
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  // Fallback - ip property may not exist on NextRequest in all versions
  return 'unknown'
}

/**
 * Create a composite identifier for rate limiting
 */
export function createIdentifier(
  ip: string,
  userId?: string,
  additionalKey?: string
): string {
  const parts = [ip]
  if (userId) parts.push(userId)
  if (additionalKey) parts.push(additionalKey)
  return parts.join(':')
}

/**
 * Generate rate limit headers for response
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
  }
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
    headers['Retry-After'] = Math.max(1, retryAfter).toString()
  }
  
  return headers
}

// ============================================================
// Rate Limiter Class
// ============================================================

class RateLimiter {
  private configCache: Map<RateLimitCategory, RateLimitConfig> = new Map()
  private configCacheTime: number = 0
  private readonly CONFIG_CACHE_TTL = 60000 // 1 minute

  /**
   * Get rate limit configuration for a category
   */
  private async getConfig(category: RateLimitCategory): Promise<RateLimitConfig> {
    // Check cache first
    const now = Date.now()
    if (now - this.configCacheTime < this.CONFIG_CACHE_TTL && this.configCache.has(category)) {
      return this.configCache.get(category)!
    }

    try {
      // Try to get config from database
      const { data, error } = await supabaseAdmin.rpc('get_rate_limit_config', {
        p_category: category
      })

      if (!error && data && data.length > 0 && data[0].is_enabled) {
        const config: RateLimitConfig = {
          maxRequests: data[0].max_requests,
          windowSeconds: data[0].window_seconds,
        }
        this.configCache.set(category, config)
        this.configCacheTime = now
        return config
      }
    } catch (err) {
      // Fallback to default config on error
      console.error('[RATE_LIMITER] Error fetching config:', err)
    }

    // Return default config
    return DEFAULT_CONFIGS[category]
  }

  /**
   * Check rate limit and increment counter
   */
  async check(
    identifier: string,
    category: RateLimitCategory,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const config = customConfig 
      ? { ...await this.getConfig(category), ...customConfig }
      : await this.getConfig(category)

    try {
      const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
        p_identifier: identifier,
        p_category: category,
        p_max_requests: config.maxRequests,
        p_window_seconds: config.windowSeconds,
      })

      if (error) {
        console.error('[RATE_LIMITER] Error checking rate limit:', error)
        // On error, allow the request (fail open) but log it
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetAt: new Date(Date.now() + config.windowSeconds * 1000),
          currentCount: 0,
        }
      }

      const result = data[0]
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt: new Date(result.reset_at),
        currentCount: result.current_count,
      }
    } catch (err) {
      console.error('[RATE_LIMITER] Exception checking rate limit:', err)
      // Fail open on exception
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
        currentCount: 0,
      }
    }
  }

  /**
   * Check rate limit without incrementing counter
   */
  async peek(
    identifier: string,
    category: RateLimitCategory
  ): Promise<RateLimitResult> {
    const config = await this.getConfig(category)

    try {
      const { data, error } = await supabaseAdmin.rpc('peek_rate_limit', {
        p_identifier: identifier,
        p_category: category,
        p_max_requests: config.maxRequests,
      })

      if (error) {
        console.error('[RATE_LIMITER] Error peeking rate limit:', error)
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetAt: new Date(Date.now() + config.windowSeconds * 1000),
          currentCount: 0,
        }
      }

      const result = data[0]
      return {
        allowed: !result.is_limited,
        remaining: result.remaining,
        resetAt: result.reset_at ? new Date(result.reset_at) : new Date(Date.now() + config.windowSeconds * 1000),
        currentCount: result.current_count,
      }
    } catch (err) {
      console.error('[RATE_LIMITER] Exception peeking rate limit:', err)
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
        currentCount: 0,
      }
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, category?: RateLimitCategory): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin.rpc('reset_rate_limit', {
        p_identifier: identifier,
        p_category: category || null,
      })

      if (error) {
        console.error('[RATE_LIMITER] Error resetting rate limit:', error)
        return false
      }

      return true
    } catch (err) {
      console.error('[RATE_LIMITER] Exception resetting rate limit:', err)
      return false
    }
  }

  /**
   * Convenience method to check rate limit from a request
   */
  async checkRequest(
    request: NextRequest,
    category: RateLimitCategory,
    userId?: string
  ): Promise<RateLimitResult & { headers: RateLimitHeaders }> {
    const ip = getClientIp(request)
    const identifier = createIdentifier(ip, userId)
    const config = await this.getConfig(category)
    const result = await this.check(identifier, category)
    const headers = getRateLimitHeaders(result, config)

    return { ...result, headers }
  }

  /**
   * Get the default config for a category
   */
  getDefaultConfig(category: RateLimitCategory): RateLimitConfig {
    return DEFAULT_CONFIGS[category]
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const rateLimiter = new RateLimiter()

// ============================================================
// Middleware Helper
// ============================================================

/**
 * Create a rate limit middleware response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  config: RateLimitConfig
): Response {
  const headers = getRateLimitHeaders(result, config)
  
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${headers['Retry-After']} seconds.`,
      retryAfter: parseInt(headers['Retry-After'] || '60'),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  )
}

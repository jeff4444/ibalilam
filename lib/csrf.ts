/**
 * CSRF Protection Utility
 * 
 * INFO-002 FIX: Implements double-submit cookie pattern for CSRF protection.
 * 
 * How it works:
 * 1. Server generates a random token and sets it in two places:
 *    - An HttpOnly cookie (csrf_token) - cannot be read by JavaScript
 *    - A non-HttpOnly cookie (csrf_token_client) - can be read by JavaScript
 * 2. Client reads the csrf_token_client cookie and sends it in X-CSRF-Token header
 * 3. Server validates that the header matches the HttpOnly cookie
 * 
 * This works because:
 * - Attackers cannot read cookies from other domains (Same-Origin Policy)
 * - Attackers cannot set custom headers in cross-origin requests
 * - The HttpOnly cookie is automatically sent with requests
 * 
 * Usage:
 *   // In middleware or API route
 *   import { generateCsrfToken, validateCsrfToken, setCsrfCookies } from '@/lib/csrf'
 *   
 *   // Generate and set cookies
 *   const token = generateCsrfToken()
 *   setCsrfCookies(response, token)
 *   
 *   // Validate in API route
 *   const isValid = validateCsrfToken(request)
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// ============================================================
// Constants
// ============================================================

export const CSRF_COOKIE_NAME = 'csrf_token'
export const CSRF_CLIENT_COOKIE_NAME = 'csrf_token_client'
export const CSRF_HEADER_NAME = 'x-csrf-token'

// Token validity period (24 hours)
const TOKEN_MAX_AGE = 60 * 60 * 24

// ============================================================
// Token Generation
// ============================================================

/**
 * Generate a cryptographically secure random token
 */
export function generateCsrfToken(): string {
  // Use Web Crypto API for secure random generation
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a simple hash for token signing (not cryptographic, just for integrity)
 */
function simpleHash(str: string, secret: string): string {
  let hash = 0
  const combined = str + secret
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Create a signed token (token + signature)
 */
export function signToken(token: string): string {
  const secret = process.env.CSRF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-csrf-secret'
  const signature = simpleHash(token, secret)
  return `${token}.${signature}`
}

/**
 * Verify a signed token
 */
export function verifySignedToken(signedToken: string): string | null {
  const parts = signedToken.split('.')
  if (parts.length !== 2) return null
  
  const [token, signature] = parts
  const secret = process.env.CSRF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-csrf-secret'
  const expectedSignature = simpleHash(token, secret)
  
  if (signature !== expectedSignature) return null
  return token
}

// ============================================================
// Cookie Management
// ============================================================

/**
 * Set CSRF cookies on a response
 */
export function setCsrfCookies(response: NextResponse, token?: string): string {
  const csrfToken = token || generateCsrfToken()
  const signedToken = signToken(csrfToken)
  
  // HttpOnly cookie - server-side validation
  response.cookies.set(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
  })
  
  // Non-HttpOnly cookie - client can read this to send in header
  response.cookies.set(CSRF_CLIENT_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
  })
  
  return csrfToken
}

/**
 * Get CSRF token from cookies (for server-side use)
 */
export async function getCsrfTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  const signedToken = cookieStore.get(CSRF_COOKIE_NAME)?.value
  
  if (!signedToken) return null
  return verifySignedToken(signedToken)
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate CSRF token from request
 * Returns true if valid, false otherwise
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) {
    return false
  }
  
  // Get signed token from HttpOnly cookie
  const signedCookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!signedCookieToken) {
    return false
  }
  
  // Verify and extract the token from the signed cookie
  const cookieToken = verifySignedToken(signedCookieToken)
  if (!cookieToken) {
    return false
  }
  
  // Compare tokens (constant-time comparison to prevent timing attacks)
  return constantTimeCompare(headerToken, cookieToken)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

// ============================================================
// Middleware Helpers
// ============================================================

/**
 * Check if a request method requires CSRF validation
 */
export function requiresCsrfValidation(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  return !safeMethods.includes(method.toUpperCase())
}

/**
 * Check if a path should be excluded from CSRF validation
 */
export function isExcludedFromCsrf(pathname: string): boolean {
  const excludedPaths = [
    // PayFast webhooks use signature validation
    '/api/payfast/notify',
    '/api/payfast/wallet-notify',
    // Cron endpoints use Vercel cron secret
    '/api/cron/',
  ]
  
  return excludedPaths.some(path => pathname.startsWith(path))
}

/**
 * Create a CSRF validation error response
 */
export function createCsrfErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'CSRF validation failed',
      message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
    },
    { status: 403 }
  )
}

// ============================================================
// API Route Helper
// ============================================================

/**
 * Validate CSRF token in an API route
 * Returns an error response if validation fails, null if valid
 */
export function withCsrfValidation(request: NextRequest): NextResponse | null {
  // Skip validation for safe methods
  if (!requiresCsrfValidation(request.method)) {
    return null
  }
  
  // Skip validation for excluded paths
  if (isExcludedFromCsrf(request.nextUrl.pathname)) {
    return null
  }
  
  // Validate token
  if (!validateCsrfToken(request)) {
    return createCsrfErrorResponse()
  }
  
  return null
}

// ============================================================
// Client-Side Helper (for documentation)
// ============================================================

/**
 * Client-side code to get CSRF token from cookie:
 * 
 * function getCsrfToken(): string | null {
 *   const match = document.cookie.match(/csrf_token_client=([^;]+)/)
 *   return match ? match[1] : null
 * }
 * 
 * // Usage in fetch:
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-CSRF-Token': getCsrfToken() || '',
 *   },
 *   body: JSON.stringify(data),
 * })
 */

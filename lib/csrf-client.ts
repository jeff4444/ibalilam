/**
 * CSRF Token Client Utility
 * 
 * INFO-002 FIX: Client-side utilities for CSRF protection.
 * 
 * Usage:
 *   import { getCsrfToken, fetchWithCsrf } from '@/lib/csrf-client'
 *   
 *   // Option 1: Use fetchWithCsrf wrapper
 *   const response = await fetchWithCsrf('/api/endpoint', {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *   })
 *   
 *   // Option 2: Get token manually
 *   const token = getCsrfToken()
 *   fetch('/api/endpoint', {
 *     headers: { 'X-CSRF-Token': token || '' },
 *   })
 */

const CSRF_CLIENT_COOKIE_NAME = 'csrf_token_client'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null
  }
  
  const match = document.cookie.match(new RegExp(`${CSRF_CLIENT_COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

/**
 * Check if a request method requires CSRF token
 */
function requiresCsrfToken(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  return !safeMethods.includes(method.toUpperCase())
}

/**
 * Fetch wrapper that automatically includes CSRF token
 */
export async function fetchWithCsrf(
  url: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method || 'GET'
  
  // Only add CSRF token for state-changing methods
  if (!requiresCsrfToken(method)) {
    return fetch(url, init)
  }
  
  const csrfToken = getCsrfToken()
  
  const headers = new Headers(init?.headers)
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }
  
  // Ensure Content-Type is set for JSON requests
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    try {
      JSON.parse(init.body)
      headers.set('Content-Type', 'application/json')
    } catch {
      // Not JSON, don't set Content-Type
    }
  }
  
  return fetch(url, {
    ...init,
    headers,
  })
}

/**
 * Create headers object with CSRF token
 */
export function createCsrfHeaders(additionalHeaders?: HeadersInit): Headers {
  const headers = new Headers(additionalHeaders)
  const csrfToken = getCsrfToken()
  
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }
  
  return headers
}

/**
 * Get CSRF headers as a plain object (useful for fetch)
 */
export function getCsrfHeaders(): Record<string, string> {
  const csrfToken = getCsrfToken()
  
  if (!csrfToken) {
    return {}
  }
  
  return {
    [CSRF_HEADER_NAME]: csrfToken,
  }
}

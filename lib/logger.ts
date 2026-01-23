/**
 * Centralized Logger Utility
 * 
 * Security features:
 * - Environment-aware logging (debug only in development)
 * - Sensitive data sanitization before logging
 * - Structured log levels (debug, info, warn, error)
 * 
 * LOW-001 Fix: Replaces raw console.* statements throughout the codebase
 */

const isDevelopment = process.env.NODE_ENV === 'development'

// Patterns to redact from logs - matches common sensitive field patterns
const SENSITIVE_PATTERNS = [
  /password["\s:=]+["']?[^"'\s,}]+/gi,
  /token["\s:=]+["']?[^"'\s,}]+/gi,
  /secret["\s:=]+["']?[^"'\s,}]+/gi,
  /api[_-]?key["\s:=]+["']?[^"'\s,}]+/gi,
  /authorization["\s:=]+["']?[^"'\s,}]+/gi,
  /bearer\s+[a-zA-Z0-9\-_.]+/gi,
  /credit[_-]?card["\s:=]+["']?[^"'\s,}]+/gi,
  /card[_-]?number["\s:=]+["']?[^"'\s,}]+/gi,
  /cvv["\s:=]+["']?[^"'\s,}]+/gi,
  /account[_-]?number["\s:=]+["']?\d+/gi,
  /passphrase["\s:=]+["']?[^"'\s,}]+/gi,
]

/**
 * Sanitize data by redacting sensitive patterns
 */
function sanitize(data: unknown): unknown {
  if (typeof data === 'string') {
    let sanitized = data
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]')
    }
    return sanitized
  }
  
  if (data instanceof Error) {
    // Preserve error structure but sanitize message
    const sanitizedMessage = sanitize(data.message) as string
    return `${data.name}: ${sanitizedMessage}`
  }
  
  if (typeof data === 'object' && data !== null) {
    try {
      // Convert to string and sanitize
      const jsonString = JSON.stringify(data)
      return sanitize(jsonString)
    } catch {
      return '[Object - could not stringify]'
    }
  }
  
  return data
}

/**
 * Format timestamp for log entries
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

export const logger = {
  /**
   * Debug level - only logs in development environment
   * Use for detailed debugging information
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[DEBUG ${getTimestamp()}]`, ...args.map(sanitize))
    }
  },

  /**
   * Info level - logs in all environments
   * Use for general operational information
   */
  info: (...args: unknown[]) => {
    console.log(`[INFO ${getTimestamp()}]`, ...args.map(sanitize))
  },

  /**
   * Warn level - logs in all environments
   * Use for potentially harmful situations
   */
  warn: (...args: unknown[]) => {
    console.warn(`[WARN ${getTimestamp()}]`, ...args.map(sanitize))
  },

  /**
   * Error level - logs in all environments
   * Use for error events that might still allow the application to continue
   */
  error: (...args: unknown[]) => {
    console.error(`[ERROR ${getTimestamp()}]`, ...args.map(sanitize))
  },

  /**
   * Audit level - always logs, used for security-relevant events
   * Use for authentication, authorization, and sensitive operations
   */
  audit: (event: string, details?: Record<string, unknown>) => {
    const sanitizedDetails = details ? sanitize(details) : ''
    console.log(`[AUDIT ${getTimestamp()}] ${event}`, sanitizedDetails)
  }
}

export default logger

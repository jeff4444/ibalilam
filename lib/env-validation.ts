/**
 * Environment Variable Validation
 * 
 * VULN-022 FIX: Validates required environment variables at startup
 * to prevent runtime errors and security misconfigurations.
 * 
 * VULN-023 FIX: Standardizes URL environment variables with fallback support
 */

// Type definitions for environment configuration
export interface EnvConfig {
  // Supabase configuration (required)
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  
  // Service role key (required for server-side admin operations)
  SUPABASE_SERVICE_ROLE_KEY?: string
  
  // PayFast configuration (required for payments)
  MERCHANT_ID?: string
  MERCHANT_KEY?: string
  PAYFAST_PASSPHRASE?: string
  PAYFAST_URL?: string
  
  // Application URL (standardized - VULN-023 fix)
  NEXT_PUBLIC_APP_URL: string
}

// Required environment variables that must be present
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

// Environment variables required for payment processing
const PAYMENT_ENV_VARS = [
  'MERCHANT_ID',
  'MERCHANT_KEY',
  'PAYFAST_PASSPHRASE',
  'PAYFAST_URL',
] as const

/**
 * Validates that all required environment variables are present.
 * Throws an error with helpful message if any are missing.
 */
function validateRequiredEnv(): void {
  const missing: string[] = []
  
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }
  
  if (missing.length > 0) {
    const errorMessage = [
      `Missing required environment variables: ${missing.join(', ')}`,
      '',
      'Please ensure these variables are set in your .env.local file or deployment configuration.',
      '',
      'Required variables:',
      ...REQUIRED_ENV_VARS.map(v => `  - ${v}`),
    ].join('\n')
    
    throw new Error(errorMessage)
  }
}

/**
 * Gets the standardized application URL.
 * VULN-023 FIX: Supports multiple legacy variable names for backward compatibility.
 */
function getAppUrl(): string {
  // Priority order for URL resolution
  const url = process.env.NEXT_PUBLIC_APP_URL || 
              process.env.NEXT_PUBLIC_BASE_URL || 
              process.env.NEXT_PUBLIC_SITE_URL ||
              process.env.VERCEL_URL // Vercel provides this automatically
  
  if (!url) {
    // In development, default to localhost
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3000'
    }
    
    console.warn(
      'Warning: No application URL configured. ' +
      'Set NEXT_PUBLIC_APP_URL in your environment variables.'
    )
    return ''
  }
  
  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Vercel URLs need https
    return `https://${url}`
  }
  
  // Remove trailing slash for consistency
  return url.replace(/\/$/, '')
}

/**
 * Validates environment and returns typed configuration.
 * Call this at application startup.
 */
function createEnvConfig(): EnvConfig {
  // Validate required variables
  validateRequiredEnv()
  
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    MERCHANT_ID: process.env.MERCHANT_ID,
    MERCHANT_KEY: process.env.MERCHANT_KEY,
    PAYFAST_PASSPHRASE: process.env.PAYFAST_PASSPHRASE,
    PAYFAST_URL: process.env.PAYFAST_URL,
    NEXT_PUBLIC_APP_URL: getAppUrl(),
  }
}

/**
 * Checks if payment processing is properly configured.
 * Returns an object with validation status and missing variables.
 */
export function validatePaymentConfig(): { 
  isConfigured: boolean
  missing: string[] 
} {
  const missing: string[] = []
  
  for (const key of PAYMENT_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }
  
  return {
    isConfigured: missing.length === 0,
    missing,
  }
}

/**
 * Gets the Supabase URL with validation.
 * Use this instead of directly accessing process.env.
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  return url
}

/**
 * Gets the Supabase anon key with validation.
 * Use this instead of directly accessing process.env.
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  }
  return key
}

/**
 * Gets the Supabase service role key with validation.
 * Only available on server-side.
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'This key is required for admin operations.'
    )
  }
  return key
}

// Lazy-loaded environment configuration
// This ensures validation happens at runtime when variables are actually needed,
// not at module import time (which can happen before Next.js loads .env.local)
let cachedEnv: EnvConfig | null = null

function getEnvConfig(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = createEnvConfig()
  }
  return cachedEnv
}

// Create and export the validated environment configuration
// This will throw when first accessed if required variables are missing
// Uses lazy loading to ensure .env.local is loaded before validation
export const env: EnvConfig = new Proxy({} as EnvConfig, {
  get(_target, prop: keyof EnvConfig) {
    return getEnvConfig()[prop]
  }
})

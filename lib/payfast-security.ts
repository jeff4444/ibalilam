import { NextRequest } from "next/server"
import { logger } from "@/lib/logger"

/**
 * PayFast IP Validation Security Module
 * 
 * This module validates that IPN (Instant Payment Notification) requests
 * originate from official PayFast IP addresses to prevent forged payment notifications.
 * 
 * VULN-002 Fix: Validates source IP before processing any payment notifications.
 */

// Official PayFast IP ranges - Legacy on-premises (CIDR notation)
// These should be kept during the AWS migration transition period
const PAYFAST_LEGACY_RANGES: string[] = [
  "197.97.145.144/28",   // 197.97.145.144 - 197.97.145.159
  "41.74.179.192/27",    // 41.74.179.192 - 41.74.179.223
  "102.216.36.0/28",     // 102.216.36.0 - 102.216.36.15
  "102.216.36.128/28",   // 102.216.36.128 - 102.216.36.143
  "144.126.193.139/32",  // Single IP
]

// New AWS IPs (effective July 31, 2025) - all 21 individual IPs
// Source: PayFast official communication regarding AWS migration
const PAYFAST_AWS_IPS: string[] = [
  "3.163.232.237",
  "3.163.233.237",
  "3.163.234.237",
  "3.163.235.237",
  "3.163.236.237",
  "3.163.237.237",
  "3.163.238.237",
  "3.163.239.237",
  "3.163.240.237",
  "3.163.241.237",
  "3.163.242.237",
  "3.163.243.237",
  "3.163.244.237",
  "3.163.245.237",
  "3.163.246.237",
  "3.163.247.237",
  "3.163.248.237",
  "3.163.249.237",
  "3.163.250.237",
  "3.163.251.237",
  "3.163.252.237",
]

/**
 * Convert an IPv4 address string to a 32-bit integer
 */
function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return -1 // Invalid IP
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/**
 * Parse a CIDR notation string and return the network address and mask
 */
function parseCIDR(cidr: string): { network: number; mask: number } | null {
  const parts = cidr.split("/")
  if (parts.length !== 2) return null

  const ip = parts[0]
  const prefixLength = parseInt(parts[1], 10)

  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) return null

  const network = ipToInt(ip)
  if (network === -1) return null

  // Create mask: e.g., /28 = 0xFFFFFFF0
  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0

  return { network: network & mask, mask }
}

/**
 * Check if an IP address falls within a CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const ipInt = ipToInt(ip)
  if (ipInt === -1) return false

  const parsed = parseCIDR(cidr)
  if (!parsed) return false

  return (ipInt & parsed.mask) === parsed.network
}

/**
 * Check if an IP address is in the list of individual IPs
 */
function isIPInList(ip: string, ipList: string[]): boolean {
  return ipList.includes(ip)
}

/**
 * Validate if the given IP address is an official PayFast IP
 * 
 * @param ip - The IP address to validate (can be null/undefined)
 * @returns true if the IP is from PayFast, false otherwise
 */
export function isValidPayFastIP(ip: string | null | undefined): boolean {
  // Allow bypass for local development/testing only
  if (process.env.PAYFAST_SKIP_IP_CHECK === "true") {
    logger.warn("PayFast IP check bypassed - PAYFAST_SKIP_IP_CHECK is enabled")
    return true
  }

  if (!ip) {
    return false
  }

  // Trim and normalize the IP
  const normalizedIP = ip.trim()

  // Check against legacy CIDR ranges
  for (const cidr of PAYFAST_LEGACY_RANGES) {
    if (isIPInCIDR(normalizedIP, cidr)) {
      return true
    }
  }

  // Check against new AWS IPs
  if (isIPInList(normalizedIP, PAYFAST_AWS_IPS)) {
    return true
  }

  return false
}

/**
 * Extract the client IP address from a Next.js request
 * 
 * Handles various proxy headers in order of preference:
 * 1. x-forwarded-for (standard proxy header, take first IP)
 * 2. x-real-ip (Nginx proxy header)
 * 3. cf-connecting-ip (Cloudflare)
 * 
 * @param request - The NextRequest object
 * @returns The client IP address or null if not found
 */
export function getClientIP(request: NextRequest): string | null {
  // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
  // The first one is the original client IP
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0].trim()
    if (firstIP) {
      return firstIP
    }
  }

  // x-real-ip is typically set by Nginx
  const realIP = request.headers.get("x-real-ip")
  if (realIP) {
    return realIP.trim()
  }

  // cf-connecting-ip is set by Cloudflare
  const cfIP = request.headers.get("cf-connecting-ip")
  if (cfIP) {
    return cfIP.trim()
  }

  // Fallback: try to get IP from the request (may not work in all environments)
  // In Vercel/serverless, the IP is typically in headers
  return null
}

/**
 * Validate PayFast IPN request source and return appropriate error if invalid
 * 
 * @param request - The NextRequest object
 * @returns Object with isValid boolean and clientIP string
 */
export function validatePayFastSource(request: NextRequest): {
  isValid: boolean
  clientIP: string | null
} {
  const clientIP = getClientIP(request)
  const isValid = isValidPayFastIP(clientIP)

  return { isValid, clientIP }
}

/**
 * VULN-003 Fix: Server-to-Server IPN Validation
 * 
 * Validates IPN data by sending it back to PayFast's validation endpoint.
 * This is the recommended approach by PayFast to ensure the IPN is authentic.
 * 
 * @param ipnData - The IPN data received from PayFast (excluding signature)
 * @param passphrase - The PayFast passphrase for signature generation
 * @returns Object with isValid boolean and error message if invalid
 */
export async function validatePayFastIPNWithServer(
  ipnData: Record<string, string>,
  passphrase: string | null
): Promise<{ isValid: boolean; error?: string }> {
  // Allow bypass for local development/testing only
  if (process.env.PAYFAST_SKIP_SERVER_VALIDATION === "true") {
    logger.warn("PayFast server validation bypassed - PAYFAST_SKIP_SERVER_VALIDATION is enabled")
    return { isValid: true }
  }

  // Determine validation URL based on environment
  const isSandbox = process.env.PAYFAST_URL?.includes("sandbox")
  const validateUrl = isSandbox
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://api.payfast.co.za/eng/query/validate"

  try {
    // Build the parameter string in the same order as received
    // PayFast requires the data to be sent back in the exact same format
    const paramString = buildPayFastParamString(ipnData, passphrase)

    // Send validation request to PayFast with retry logic
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(validateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: paramString,
          // Set a reasonable timeout
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        const responseText = await response.text()

        // PayFast returns "VALID" for valid IPNs, "INVALID" for invalid ones
        if (responseText.trim().toUpperCase() === "VALID") {
          return { isValid: true }
        } else if (responseText.trim().toUpperCase() === "INVALID") {
          return { 
            isValid: false, 
            error: `PayFast server validation failed: IPN data is INVALID` 
          }
        } else {
          // Unexpected response
          logger.error(`PayFast validation unexpected response: ${responseText}`)
          return { 
            isValid: false, 
            error: `PayFast server validation returned unexpected response: ${responseText}` 
          }
        }
      } catch (fetchError) {
        lastError = fetchError as Error
        logger.error(`PayFast validation attempt ${attempt} failed:`, fetchError)
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    // All retries failed
    logger.error("PayFast server validation failed after all retries:", lastError)
    return { 
      isValid: false, 
      error: `PayFast server validation failed after ${maxRetries} attempts: ${lastError?.message}` 
    }
  } catch (error) {
    logger.error("PayFast server validation error:", error)
    return { 
      isValid: false, 
      error: `PayFast server validation error: ${(error as Error).message}` 
    }
  }
}

/**
 * Build the parameter string for PayFast validation
 * The parameters must be in the exact order they were received
 */
function buildPayFastParamString(
  data: Record<string, string>,
  passphrase: string | null
): string {
  let paramString = ""

  for (const key in data) {
    if (data.hasOwnProperty(key) && key !== "signature") {
      const value = data[key]
      if (value !== undefined && value !== null && value !== "") {
        const encoded = encodeURIComponent(value.trim())
          .replace(/%20/g, "+")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
        paramString += `${key}=${encoded}&`
      }
    }
  }

  // Remove trailing ampersand
  paramString = paramString.slice(0, -1)

  // Add passphrase if provided
  if (passphrase) {
    const encodedPass = encodeURIComponent(passphrase.trim())
      .replace(/%20/g, "+")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
    paramString += `&passphrase=${encodedPass}`
  }

  return paramString
}

/**
 * VULN-003 Fix: Safe Amount Comparison in Cents
 * 
 * Compares two monetary amounts by converting them to cents (integers)
 * to avoid floating-point precision issues.
 * 
 * @param amount1 - First amount (can be string or number)
 * @param amount2 - Second amount (can be string or number)
 * @returns true if amounts match exactly when converted to cents
 */
export function amountMatchesInCents(
  amount1: string | number,
  amount2: string | number
): boolean {
  const cents1 = toCents(amount1)
  const cents2 = toCents(amount2)

  // If either conversion failed, return false
  if (cents1 === null || cents2 === null) {
    return false
  }

  return cents1 === cents2
}

/**
 * Convert a monetary amount to cents (integer)
 * Handles both string and number inputs safely
 * 
 * @param amount - The amount to convert
 * @returns The amount in cents as an integer, or null if invalid
 */
export function toCents(amount: string | number): number | null {
  let numericAmount: number

  if (typeof amount === "string") {
    // Remove any currency symbols, spaces, and commas
    const cleaned = amount.replace(/[R$€£\s,]/g, "").trim()
    numericAmount = parseFloat(cleaned)
  } else {
    numericAmount = amount
  }

  // Validate the amount
  if (isNaN(numericAmount) || !isFinite(numericAmount)) {
    return null
  }

  // Convert to cents by multiplying by 100 and rounding to avoid floating point issues
  // Using Math.round to handle cases like 10.005 -> 1001 (not 1000)
  return Math.round(numericAmount * 100)
}

/**
 * Security audit log entry interface
 */
export interface PayFastAuditLogEntry {
  timestamp: string
  event_type: "ipn_received" | "ip_validation" | "signature_validation" | "server_validation" | "amount_validation" | "order_update" | "error"
  success: boolean
  order_id?: string
  payment_id?: string
  client_ip?: string
  details?: Record<string, unknown>
  error_message?: string
}

/**
 * Create a structured audit log entry for PayFast security events
 * 
 * @param entry - The audit log entry data
 * @returns Formatted log string for consistent logging
 */
export function createAuditLogEntry(entry: PayFastAuditLogEntry): string {
  const logEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
    service: "payfast-ipn",
  }

  return JSON.stringify(logEntry)
}

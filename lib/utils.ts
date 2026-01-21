import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize search input for use in Supabase PostgREST filters.
 * Removes/escapes characters that could break filter syntax.
 * 
 * SECURITY FIX: VULN-010 - Prevents SQL injection via search parameters
 * 
 * PostgREST filter special chars that are stripped: . , ( ) " ' \ % _ *
 * These characters can break out of the intended filter context and allow
 * filter manipulation, data exfiltration, or denial of service.
 * 
 * @param input - The raw search input from the user
 * @param options - Configuration options
 * @param options.maxLength - Maximum allowed length (default: 100)
 * @param options.allowWildcards - Whether to allow SQL wildcards % _ * (default: false)
 * @returns Sanitized string safe for use in PostgREST filters
 */
export function sanitizeSearchInput(input: string | null | undefined, options?: {
  maxLength?: number;
  allowWildcards?: boolean;
}): string {
  const { maxLength = 100, allowWildcards = false } = options || {};
  
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input
    // Trim whitespace
    .trim()
    // Remove null bytes (can cause issues in some systems)
    .replace(/\0/g, '')
    // Remove PostgREST filter syntax characters that could break out of filter context
    // . is used for column.operator syntax
    // , is used to separate multiple filters in .or()
    // ( ) are used for grouping and function calls
    // " ' are used for string literals
    // \ is escape character
    .replace(/[.,()'"\\]/g, '');
  
  // Remove SQL wildcards unless explicitly allowed
  // % matches any sequence of characters
  // _ matches any single character
  // * is sometimes used as wildcard
  if (!allowWildcards) {
    sanitized = sanitized.replace(/[%_*]/g, '');
  }
  
  // Enforce maximum length to prevent DoS via extremely long inputs
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate that a search string is safe and non-empty after sanitization.
 * 
 * @param input - The raw search input to validate
 * @returns true if the input produces a valid, non-empty sanitized string
 */
export function isValidSearchInput(input: string | null | undefined): boolean {
  if (!input) return false;
  const sanitized = sanitizeSearchInput(input);
  return sanitized.length > 0 && sanitized.length <= 100;
}

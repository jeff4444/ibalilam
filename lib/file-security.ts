/**
 * File Security Utilities
 * 
 * VULN-018 FIX: Secure file upload handling to prevent path traversal attacks
 * and ensure only allowed file types are uploaded.
 */

import crypto from 'crypto'

// Whitelist of allowed image extensions
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const
type AllowedImageExtension = typeof ALLOWED_IMAGE_EXTENSIONS[number]

// Whitelist of allowed MIME types mapped to extensions
const MIME_TO_EXTENSION: Record<string, AllowedImageExtension> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

// Allowed MIME types for validation
export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(MIME_TO_EXTENSION)

/**
 * Sanitizes a filename and extracts a safe extension.
 * 
 * Security measures:
 * - Removes path traversal characters (/, \, ..)
 * - Validates extension against whitelist
 * - Returns null if extension is invalid or potentially malicious
 * 
 * @param filename - The original filename from user input
 * @returns The sanitized extension or null if invalid
 */
export function sanitizeFileExtension(filename: string): AllowedImageExtension | null {
  if (!filename || typeof filename !== 'string') {
    return null
  }

  // Remove any path traversal attempts and null bytes
  const sanitized = filename
    .replace(/\0/g, '')           // Remove null bytes
    .replace(/[\/\\]/g, '')       // Remove path separators
    .replace(/\.\./g, '')         // Remove parent directory references
    .trim()

  if (!sanitized) {
    return null
  }

  // Extract extension safely - only consider the last part after the final dot
  const lastDotIndex = sanitized.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === sanitized.length - 1) {
    return null
  }

  const ext = sanitized.substring(lastDotIndex + 1).toLowerCase()

  // Validate against whitelist
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as AllowedImageExtension)) {
    return null
  }

  return ext as AllowedImageExtension
}

/**
 * Gets the file extension from a MIME type.
 * More reliable than extracting from filename as MIME type comes from file content.
 * 
 * @param mimeType - The MIME type of the file
 * @returns The corresponding extension or null if not allowed
 */
export function getExtensionFromMimeType(mimeType: string): AllowedImageExtension | null {
  if (!mimeType || typeof mimeType !== 'string') {
    return null
  }

  const normalizedMime = mimeType.toLowerCase().trim()
  return MIME_TO_EXTENSION[normalizedMime] || null
}

/**
 * Generates a secure filename for storage.
 * 
 * Security measures:
 * - Uses cryptographically random UUID
 * - Includes timestamp for uniqueness
 * - User ID is used as directory prefix for isolation
 * - Extension is validated before use
 * 
 * @param userId - The user's ID (used as directory prefix)
 * @param extension - The validated file extension
 * @param prefix - Optional prefix for the path (e.g., 'parts', 'messages')
 * @returns A secure file path
 */
export function generateSecureFilename(
  userId: string,
  extension: AllowedImageExtension,
  prefix?: string
): string {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID')
  }

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    throw new Error('Invalid file extension')
  }

  // Sanitize userId to prevent path traversal
  const sanitizedUserId = userId.replace(/[\/\\\.]/g, '')

  const timestamp = Date.now()
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  
  const filename = `${timestamp}-${randomPart}.${extension}`
  
  if (prefix) {
    const sanitizedPrefix = prefix.replace(/[\/\\\.]/g, '')
    return `${sanitizedPrefix}/${sanitizedUserId}/${filename}`
  }
  
  return `${sanitizedUserId}/${filename}`
}

/**
 * Validates that a file meets security requirements.
 * 
 * @param file - The file object to validate
 * @param maxSizeBytes - Maximum allowed file size in bytes
 * @returns An object with validation result and error message if invalid
 */
export function validateFileUpload(
  file: { name: string; type: string; size: number },
  maxSizeBytes: number = 10 * 1024 * 1024 // Default 10MB
): { valid: boolean; error?: string; extension?: AllowedImageExtension } {
  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024))
    return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' }
  }

  // Validate MIME type (more reliable than filename extension)
  const extensionFromMime = getExtensionFromMimeType(file.type)
  if (!extensionFromMime) {
    return { 
      valid: false, 
      error: `Invalid file type "${file.type}". Allowed types: JPG, PNG, GIF, WebP.` 
    }
  }

  // Also validate filename extension matches MIME type (defense in depth)
  const extensionFromName = sanitizeFileExtension(file.name)
  if (!extensionFromName) {
    return { 
      valid: false, 
      error: 'Invalid or missing file extension. Allowed: .jpg, .jpeg, .png, .gif, .webp' 
    }
  }

  // Check for extension mismatch (potential attack indicator)
  // Allow jpg/jpeg interchangeability
  const normalizedMimeExt = extensionFromMime === 'jpg' ? 'jpeg' : extensionFromMime
  const normalizedNameExt = extensionFromName === 'jpg' ? 'jpeg' : extensionFromName
  
  if (normalizedMimeExt !== normalizedNameExt && 
      !(extensionFromMime === 'jpg' && extensionFromName === 'jpeg') &&
      !(extensionFromMime === 'jpeg' && extensionFromName === 'jpg')) {
    console.warn(`File extension mismatch: MIME suggests ${extensionFromMime}, filename has ${extensionFromName}`)
    // Use MIME type extension as it's more reliable
  }

  return { valid: true, extension: extensionFromMime }
}

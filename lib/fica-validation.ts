/**
 * Client-side FICA Validation Utilities
 * 
 * Provides validation functions for FICA verification form fields
 * to ensure data quality before submission.
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validates a name field (first name, last name, owner name)
 * Rules: 2-100 characters, letters, spaces, hyphens, and apostrophes only
 */
export function validateName(name: string, fieldName: string): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters` }
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: `${fieldName} must be less than 100 characters` }
  }

  // Allow letters, spaces, hyphens, and apostrophes
  const namePattern = /^[a-zA-Z\s\-']+$/
  if (!namePattern.test(trimmed)) {
    return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` }
  }

  return { isValid: true }
}

/**
 * Validates a South African phone number
 * Formats: +27XXXXXXXXX, 0XXXXXXXXX, or 0XX XXX XXXX
 */
export function validatePhoneNumber(phone: string, fieldName: string): ValidationResult {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const cleaned = phone.replace(/\s+/g, '').replace(/[-\s()]/g, '')
  
  // South African phone number patterns:
  // - International: +27XXXXXXXXX (10 digits after +27)
  // - National: 0XXXXXXXXX (10 digits starting with 0)
  // - Mobile: 0XX XXX XXXX (10 digits)
  const saPhonePattern = /^(\+27|0)[1-9]\d{8,9}$/
  
  if (!saPhonePattern.test(cleaned)) {
    return { 
      isValid: false, 
      error: `${fieldName} must be a valid South African phone number (e.g., +27XXXXXXXXX or 0XXXXXXXXX)` 
    }
  }

  return { isValid: true }
}

/**
 * Validates an email address
 */
export function validateEmail(email: string, fieldName: string): ValidationResult {
  if (!email || !email.trim()) {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const trimmed = email.trim()
  
  // Basic email validation pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailPattern.test(trimmed)) {
    return { isValid: false, error: `${fieldName} must be a valid email address` }
  }

  if (trimmed.length > 255) {
    return { isValid: false, error: `${fieldName} must be less than 255 characters` }
  }

  return { isValid: true }
}

/**
 * Validates an address field
 */
export function validateAddress(address: string, fieldName: string): ValidationResult {
  if (!address || !address.trim()) {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const trimmed = address.trim()
  
  if (trimmed.length < 5) {
    return { isValid: false, error: `${fieldName} must be at least 5 characters` }
  }

  if (trimmed.length > 500) {
    return { isValid: false, error: `${fieldName} must be less than 500 characters` }
  }

  return { isValid: true }
}

/**
 * Validates a business name
 */
export function validateBusinessName(name: string, fieldName: string): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters` }
  }

  if (trimmed.length > 200) {
    return { isValid: false, error: `${fieldName} must be less than 200 characters` }
  }

  return { isValid: true }
}

/**
 * Validates a South African business registration number
 * Format: YYYY/MM/DD/XX or similar variations
 */
export function validateRegistrationNumber(regNumber: string, fieldName: string): ValidationResult {
  if (!regNumber || !regNumber.trim()) {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const trimmed = regNumber.trim()
  
  if (trimmed.length < 5) {
    return { isValid: false, error: `${fieldName} must be at least 5 characters` }
  }

  if (trimmed.length > 50) {
    return { isValid: false, error: `${fieldName} must be less than 50 characters` }
  }

  // Allow alphanumeric, slashes, hyphens, and spaces
  const regNumberPattern = /^[a-zA-Z0-9\s\/\-]+$/
  if (!regNumberPattern.test(trimmed)) {
    return { 
      isValid: false, 
      error: `${fieldName} can only contain letters, numbers, spaces, slashes, and hyphens` 
    }
  }

  return { isValid: true }
}

/**
 * Validates all FICA personal information fields
 */
export interface FicaPersonalInfo {
  firstName: string
  lastName: string
  phone: string
  address: string
}

export function validateFicaPersonalInfo(info: FicaPersonalInfo): {
  isValid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  const firstNameResult = validateName(info.firstName, 'First Name')
  if (!firstNameResult.isValid) {
    errors.firstName = firstNameResult.error || ''
  }

  const lastNameResult = validateName(info.lastName, 'Last Name')
  if (!lastNameResult.isValid) {
    errors.lastName = lastNameResult.error || ''
  }

  const phoneResult = validatePhoneNumber(info.phone, 'Contact Number')
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.error || ''
  }

  const addressResult = validateAddress(info.address, 'Address')
  if (!addressResult.isValid) {
    errors.address = addressResult.error || ''
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validates all FICA business information fields
 */
export interface FicaBusinessInfo {
  name: string
  registration_number: string
  owner_name: string
  owner_phone: string
  owner_email: string
}

export function validateFicaBusinessInfo(info: FicaBusinessInfo): {
  isValid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  const businessNameResult = validateBusinessName(info.name, 'Business Name')
  if (!businessNameResult.isValid) {
    errors.name = businessNameResult.error || ''
  }

  const regNumberResult = validateRegistrationNumber(info.registration_number, 'Registration Number')
  if (!regNumberResult.isValid) {
    errors.registration_number = regNumberResult.error || ''
  }

  const ownerNameResult = validateName(info.owner_name, 'Owner Name')
  if (!ownerNameResult.isValid) {
    errors.owner_name = ownerNameResult.error || ''
  }

  const ownerPhoneResult = validatePhoneNumber(info.owner_phone, 'Owner Phone')
  if (!ownerPhoneResult.isValid) {
    errors.owner_phone = ownerPhoneResult.error || ''
  }

  const ownerEmailResult = validateEmail(info.owner_email, 'Owner Email')
  if (!ownerEmailResult.isValid) {
    errors.owner_email = ownerEmailResult.error || ''
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

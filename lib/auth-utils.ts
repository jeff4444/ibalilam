// Utility functions for clearing authentication cache

export const clearAuthCache = () => {
  // Clear localStorage
  if (typeof window !== 'undefined') {
    // Clear Supabase auth tokens
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key)
      }
    })

    // Clear sessionStorage
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        sessionStorage.removeItem(key)
      }
    })

    // Clear any other auth-related storage
    localStorage.removeItem('auth-token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('auth-token')
    sessionStorage.removeItem('user')
  }
}

export const clearAllCache = () => {
  if (typeof window !== 'undefined') {
    // Clear all localStorage
    localStorage.clear()
    
    // Clear all sessionStorage
    sessionStorage.clear()
    
    // Clear cookies (if any auth cookies exist)
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    })
  }
}

// Development helper - add to window for easy access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).clearAuthCache = clearAuthCache
  (window as any).clearAllCache = clearAllCache
}

// ============================================================
// Server-side admin verification utilities
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js'

export type AdminRole = 'super_admin' | 'admin' | 'moderator'

export interface AdminInfo {
  isAdmin: boolean
  role: AdminRole | null
  userId: string
}

/**
 * Verify if a user is an admin by checking the admins table
 * This is the secure way to check admin status - the admins table
 * can only be modified via service_role
 */
export async function verifyAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<AdminInfo> {
  const { data: admin, error } = await supabase
    .from('admins')
    .select('role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !admin) {
    return { isAdmin: false, role: null, userId }
  }

  return {
    isAdmin: true,
    role: admin.role as AdminRole,
    userId
  }
}

/**
 * Check if user has at least the specified admin role
 * Role hierarchy: super_admin > admin > moderator
 */
export function hasMinimumRole(
  userRole: AdminRole | null,
  requiredRole: AdminRole
): boolean {
  if (!userRole) return false

  const roleHierarchy: Record<AdminRole, number> = {
    'super_admin': 3,
    'admin': 2,
    'moderator': 1
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

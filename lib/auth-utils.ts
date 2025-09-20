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

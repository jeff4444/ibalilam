import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// ============================================================
// INFO-002 FIX: CSRF Protection Constants and Functions
// ============================================================
// Note: These are duplicated from lib/csrf.ts because middleware
// runs at the Edge and cannot import server-only modules

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_CLIENT_COOKIE_NAME = 'csrf_token_client'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_MAX_AGE = 60 * 60 * 24 // 24 hours

function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

function simpleHash(str: string, secret: string): string {
  let hash = 0
  const combined = str + secret
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function signToken(token: string): string {
  // Use a fallback secret for Edge runtime (env vars are available)
  const secret = process.env.CSRF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-csrf-secret'
  const signature = simpleHash(token, secret)
  return `${token}.${signature}`
}

function verifySignedToken(signedToken: string): string | null {
  const parts = signedToken.split('.')
  if (parts.length !== 2) return null
  
  const [token, signature] = parts
  const secret = process.env.CSRF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-csrf-secret'
  const expectedSignature = simpleHash(token, secret)
  
  if (signature !== expectedSignature) return null
  return token
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function requiresCsrfValidation(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  return !safeMethods.includes(method.toUpperCase())
}

function isExcludedFromCsrf(pathname: string): boolean {
  const excludedPaths = [
    '/api/payfast/notify',
    '/api/payfast/wallet-notify',
    '/api/cron/',
  ]
  return excludedPaths.some(path => pathname.startsWith(path))
}

// VULN-022 FIX: Validate environment variables at middleware level
// Note: We can't use the full env-validation module here due to Edge runtime limitations
// So we do inline validation with helpful error messages
function getValidatedEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env.local file or deployment configuration.'
    );
  }
  
  return { supabaseUrl, supabaseKey };
}

export async function middleware(request: NextRequest) {
  // VULN-022 FIX: Get validated environment variables
  const { supabaseUrl, supabaseKey } = getValidatedEnv();
  
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // ============================================================
  // INFO-002 FIX: CSRF Validation for API Routes
  // ============================================================
  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api/')
  
  if (isApiRoute && requiresCsrfValidation(request.method) && !isExcludedFromCsrf(pathname)) {
    // Get token from header
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    
    // Get signed token from HttpOnly cookie
    const signedCookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
    
    if (!headerToken || !signedCookieToken) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      )
    }
    
    // Verify and extract the token from the signed cookie
    const cookieToken = verifySignedToken(signedCookieToken)
    
    if (!cookieToken || !constantTimeCompare(headerToken, cookieToken)) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      )
    }
  }

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes that require authentication (VULN-016 fix)
  const protectedRoutes = [
    '/profile',
    '/dashboard',
    '/sell',
    '/checkout',
    '/wallet',
    '/orders',
    '/messages',
    '/favorites',
    '/cart'
  ];
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // Admin routes that require admin role
  const adminRoutes = ['/admin'];
  const isAdminRoute = adminRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // If accessing a protected route without authentication, redirect to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If accessing an admin route, just check if user is authenticated
  // Let the admin pages handle their own role checking
  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and trying to access login/signup, redirect to dashboard
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // ============================================================
  // INFO-002 FIX: Set CSRF cookies if not present
  // ============================================================
  const existingCsrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  
  if (!existingCsrfToken || !verifySignedToken(existingCsrfToken)) {
    // Generate new CSRF token
    const csrfToken = generateCsrfToken()
    const signedToken = signToken(csrfToken)
    
    // Set HttpOnly cookie
    supabaseResponse.cookies.set(CSRF_COOKIE_NAME, signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_MAX_AGE,
    })
    
    // Set non-HttpOnly cookie for client to read
    supabaseResponse.cookies.set(CSRF_CLIENT_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_MAX_AGE,
    })
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

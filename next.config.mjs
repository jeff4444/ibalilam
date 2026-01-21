/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  
  // INFO-003 FIX: Comprehensive security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable XSS filter in browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Force HTTPS (only in production)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              // Default: only allow same origin
              "default-src 'self'",
              // Scripts: self, inline (Next.js requires), and eval (for dev)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: self and inline (Tailwind CSS)
              "style-src 'self' 'unsafe-inline'",
              // Images: self, data URIs, blob, and Supabase storage (cloud and local)
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in http://127.0.0.1:54321 http://localhost:54321",
              // Fonts: self and data URIs
              "font-src 'self' data:",
              // Connect: self, Supabase (cloud and local), and PayFast
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co http://127.0.0.1:54321 http://localhost:54321 ws://127.0.0.1:54321 ws://localhost:54321 https://www.payfast.co.za https://sandbox.payfast.co.za",
              // Media: self
              "media-src 'self'",
              // Objects: none (no plugins)
              "object-src 'none'",
              // Base URI: self
              "base-uri 'self'",
              // Form actions: self and PayFast payment gateway
              "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
              // Frame ancestors: none (prevent embedding)
              "frame-ancestors 'none'",
              // Upgrade insecure requests in production
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
      {
        // Relaxed CSP for API routes that receive webhooks
        source: '/api/payfast/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
}

export default nextConfig

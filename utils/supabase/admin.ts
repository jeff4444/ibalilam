/**
 * Supabase Admin Client - Server-Only
 * 
 * This module provides a Supabase client with service role privileges.
 * It is protected by the 'server-only' package which causes a build error
 * if this module is accidentally imported in client-side code.
 * 
 * SECURITY: This client bypasses all Row Level Security (RLS) policies.
 * Only use in API routes and server-side code where elevated privileges
 * are absolutely necessary.
 */
import "server-only"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable")
}

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
}

/**
 * Supabase admin client singleton.
 * 
 * This client uses the service role key which bypasses all RLS policies.
 * Use with caution and only when necessary for operations that require
 * elevated privileges (e.g., admin operations, webhook handlers, cron jobs).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env-validation";

/**
 * Creates a Supabase client for browser-side operations.
 * VULN-022 FIX: Uses validated environment variables instead of raw assertions.
 */
export const createClient = () =>
  createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
  );


import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createClient = async (cookieStore: ReturnType<typeof cookies>, isAdmin: boolean = false) => {
  const cookies = await cookieStore
  return createServerClient(
    supabaseUrl!,
    isAdmin ? supabaseAdminKey! : supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookies.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookies.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};

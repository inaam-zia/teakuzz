import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  if (url.includes("your-project") || key === "your-service-role-key") return false;
  return true;
}

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Database not configured. Add your Supabase keys to .env.local (or Vercel env vars) and run supabase/schema.sql."
    );
  }

  return createClient(normalizeSupabaseUrl(url!), key!);
}

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase public env vars.");
  }

  return createClient(normalizeSupabaseUrl(url), key);
}

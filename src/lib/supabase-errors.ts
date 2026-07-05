export function formatSupabaseError(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);

  if (message.includes("customer_phone")) {
    return message;
  }

  if (message.includes("Invalid path specified")) {
    return "Supabase URL should be only the project URL (e.g. https://xxx.supabase.co) — do not include /rest/v1/.";
  }

  if (message.includes("fetch failed") || message.includes("ENOTFOUND")) {
    return "Cannot reach Supabase. Open supabase.com → your project → Settings → API and copy the exact Project URL into .env.local, then restart npm run dev.";
  }

  if (message.includes("relation") && message.includes("does not exist")) {
    return "Database tables missing. In Supabase open SQL Editor, paste supabase/schema.sql, and click Run.";
  }

  return message;
}

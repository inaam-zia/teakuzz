import { NextResponse } from "next/server";
import { isSupabaseConfigured, createServerClient } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function GET() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return NextResponse.json({
      ok: false,
      supabase: false,
      message:
        "Supabase env vars missing on server. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("menu_categories").select("id").limit(1);

    if (error) {
      return NextResponse.json({
        ok: false,
        supabase: true,
        database: false,
        message: formatSupabaseError(error),
      });
    }

    return NextResponse.json({
      ok: true,
      supabase: true,
      database: true,
      message: "Database connection OK",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      supabase: true,
      database: false,
      message: formatSupabaseError(err),
    });
  }
}

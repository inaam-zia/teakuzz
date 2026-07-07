import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { newSessionId } from "@/lib/table-session";

type RouteContext = { params: { id: string } };

/** Rotate table session — use when new guests sit down (clears saved customer details). */
export async function POST(_request: Request, { params }: RouteContext) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const sessionId = newSessionId();

    const { data, error } = await supabase
      .from("cafe_tables")
      .update({ session_id: sessionId })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      if (error.message.includes("session_id")) {
        return NextResponse.json(
          {
            error:
              "Run supabase/add-table-session.sql in Supabase SQL editor to enable table sessions.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Table ${data.table_number} ready for new guests`,
      table: data,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

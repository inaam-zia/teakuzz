import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { newQrToken, newSessionId } from "@/lib/table-session";

type RouteContext = { params: { id: string } };

/**
 * Mint a new QR token (and rotate session).
 * Old printed QR codes stop working; reprint the new one.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const qrToken = newQrToken();
    const sessionId = newSessionId();

    const { data, error } = await supabase
      .from("cafe_tables")
      .update({
        qr_token: qrToken,
        session_id: sessionId,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      if (error.message.includes("qr_token")) {
        return NextResponse.json(
          {
            error:
              "Run supabase/add-table-qr-token.sql in Supabase SQL editor to enable QR regeneration.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `New QR created for Table ${data.table_number}. Old printed codes no longer work.`,
      table: data,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { newSessionId } from "@/lib/table-session";
import { formatTableRef } from "@/lib/tables";

/**
 * Staff “Close table” — rotate session so previous guests at that number
 * cannot keep ordering from a bookmarked /order/N page.
 */
export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const tableNumber = parseInt(String(body.tableNumber ?? ""), 10);

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      return NextResponse.json({ error: "Invalid table number" }, { status: 400 });
    }

    const supabase = createServerClient();
    const sessionId = newSessionId();

    const { data, error } = await supabase
      .from("cafe_tables")
      .update({ session_id: sessionId })
      .eq("table_number", tableNumber)
      .select("id, table_number, label, session_id")
      .maybeSingle();

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

    if (!data) {
      return NextResponse.json(
        { error: `No table configured for number ${tableNumber}` },
        { status: 404 }
      );
    }

    const label = formatTableRef(data.table_number, data.label);
    return NextResponse.json({
      ok: true,
      message: `${label} closed — previous guests must scan the QR again.`,
      table: data,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

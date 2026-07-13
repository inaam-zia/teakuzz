import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { newQrToken } from "@/lib/table-session";
import type { CafeTable } from "@/lib/types";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", tables: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cafe_tables")
      .select("*")
      .order("table_number");

    if (error) {
      if (error.message.includes("cafe_tables")) {
        return NextResponse.json({
          tables: [],
          needsMigration: true,
          migrationSql: "supabase/add-cafe-tables.sql",
        });
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    const admin = isAdminAuthenticated();
    const tables = (data ?? []) as CafeTable[];

    if (!admin) {
      return NextResponse.json({
        tables: tables.filter((t) => t.enabled).map((t) => t.table_number),
      });
    }

    return NextResponse.json({ tables });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const tableNumber = parseInt(String(body.tableNumber), 10);

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      return NextResponse.json(
        { error: "Table number must be between 1 and 99" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const qrToken = newQrToken();

    let { data, error } = await supabase
      .from("cafe_tables")
      .insert({ table_number: tableNumber, enabled: true, qr_token: qrToken })
      .select()
      .single();

    // Column may not exist yet — create without token
    if (error?.message.includes("qr_token")) {
      const fallback = await supabase
        .from("cafe_tables")
        .insert({ table_number: tableNumber, enabled: true })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        return NextResponse.json({ error: "This table already exists" }, { status: 409 });
      }
      if (error.message.includes("cafe_tables")) {
        return NextResponse.json(
          {
            error: "Tables not set up. Run supabase/add-cafe-tables.sql in Supabase SQL editor.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { newQrToken } from "@/lib/table-session";
import { nextAvailableTableNumber } from "@/lib/tables";
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
      .order("label", { ascending: true, nullsFirst: false })
      .order("table_number");

    if (error) {
      if (error.message.includes("cafe_tables")) {
        return NextResponse.json({
          tables: [],
          needsMigration: true,
          migrationSql: "supabase/add-cafe-tables.sql",
        });
      }
      // label column may be missing — fall back
      if (error.message.includes("label")) {
        const fallback = await supabase
          .from("cafe_tables")
          .select("*")
          .order("table_number");
        if (fallback.error) {
          return NextResponse.json(
            { error: formatSupabaseError(fallback.error) },
            { status: 500 }
          );
        }
        const admin = isAdminAuthenticated();
        const tables = (fallback.data ?? []) as CafeTable[];
        if (!admin) {
          return NextResponse.json({
            tables: tables.filter((t) => t.enabled).map((t) => t.table_number),
          });
        }
        return NextResponse.json({ tables });
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
    const name = String(body.name ?? body.label ?? "").trim();
    const notes = String(body.notes ?? "").trim().slice(0, 500);
    let tableNumber = parseInt(String(body.tableNumber ?? body.table_number ?? ""), 10);

    if (!name) {
      return NextResponse.json({ error: "Table name is required" }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json(
        { error: "Table name must be 80 characters or less" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Enforce unique name (case-insensitive)
    const { data: existing } = await supabase.from("cafe_tables").select("id, label");
    const taken = (existing ?? []).some(
      (t) => String(t.label || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (taken) {
      return NextResponse.json(
        { error: "A table with this name already exists" },
        { status: 409 }
      );
    }

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      const next = await nextAvailableTableNumber();
      if (next == null) {
        return NextResponse.json(
          { error: "Maximum of 99 tables reached" },
          { status: 400 }
        );
      }
      tableNumber = next;
    } else {
      const { data: numTaken } = await supabase
        .from("cafe_tables")
        .select("id")
        .eq("table_number", tableNumber)
        .maybeSingle();
      if (numTaken) {
        return NextResponse.json(
          { error: "Another table already uses that number" },
          { status: 409 }
        );
      }
    }

    const qrToken = newQrToken();
    const row: Record<string, unknown> = {
      table_number: tableNumber,
      enabled: true,
      label: name,
      notes,
      qr_token: qrToken,
    };

    let { data, error } = await supabase
      .from("cafe_tables")
      .insert(row)
      .select()
      .single();

    if (error?.message.includes("qr_token")) {
      delete row.qr_token;
      const fallback = await supabase.from("cafe_tables").insert(row).select().single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error?.message.includes("label") || error?.message.includes("notes")) {
      return NextResponse.json(
        {
          error:
            "Run supabase/add-table-info.sql in Supabase SQL editor to enable table names.",
        },
        { status: 503 }
      );
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

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { destroyTableData } from "@/lib/tables";
import { newQrToken, newSessionId } from "@/lib/table-session";

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data: current, error: loadError } = await supabase
      .from("cafe_tables")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (loadError || !current) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    let nameChanged = false;

    if (typeof body.enabled === "boolean") {
      updates.enabled = body.enabled;
    }

    if (body.notes !== undefined) {
      updates.notes = String(body.notes || "").trim().slice(0, 500);
    }

    if (body.name !== undefined || body.label !== undefined) {
      const name = String(body.name ?? body.label ?? "").trim();
      if (!name) {
        return NextResponse.json({ error: "Table name is required" }, { status: 400 });
      }
      if (name.length > 80) {
        return NextResponse.json(
          { error: "Table name must be 80 characters or less" },
          { status: 400 }
        );
      }

      const previous = String(current.label || "").trim();
      if (name.toLowerCase() !== previous.toLowerCase()) {
        const { data: others } = await supabase
          .from("cafe_tables")
          .select("id, label")
          .neq("id", params.id);
        const taken = (others ?? []).some(
          (t) => String(t.label || "").trim().toLowerCase() === name.toLowerCase()
        );
        if (taken) {
          return NextResponse.json(
            { error: "A table with this name already exists" },
            { status: 409 }
          );
        }
        nameChanged = true;
      }
      updates.label = name;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // Renaming destroys previous identity: wipe orders, rotate QR + session
    if (nameChanged) {
      await destroyTableData(Number(current.table_number));
      updates.qr_token = newQrToken();
      updates.session_id = newSessionId();
    }

    const { data, error } = await supabase
      .from("cafe_tables")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        return NextResponse.json(
          { error: "A table with this name already exists" },
          { status: 409 }
        );
      }
      if (error.message.includes("label") || error.message.includes("notes")) {
        return NextResponse.json(
          {
            error:
              "Run supabase/add-table-info.sql in Supabase SQL editor to enable table names.",
          },
          { status: 503 }
        );
      }
      if (error.message.includes("qr_token") || error.message.includes("session_id")) {
        // Retry without token/session if columns missing
        delete updates.qr_token;
        delete updates.session_id;
        const retry = await supabase
          .from("cafe_tables")
          .update(updates)
          .eq("id", params.id)
          .select()
          .single();
        if (retry.error) {
          return NextResponse.json(
            { error: formatSupabaseError(retry.error) },
            { status: 500 }
          );
        }
        return NextResponse.json({
          ...retry.data,
          reset: nameChanged,
          message: nameChanged
            ? "Table renamed. Previous orders for this table were deleted. Print a new QR."
            : undefined,
        });
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      ...data,
      reset: nameChanged,
      message: nameChanged
        ? "Table renamed. Previous orders for this table were deleted. Print a new QR."
        : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();

    const { data: current } = await supabase
      .from("cafe_tables")
      .select("table_number")
      .eq("id", params.id)
      .maybeSingle();

    if (current?.table_number != null) {
      await destroyTableData(Number(current.table_number));
    }

    const { error } = await supabase.from("cafe_tables").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

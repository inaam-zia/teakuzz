import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Item name is required" }, { status: 400 });
      }
      updates.name = name;
    }
    if (body.unit !== undefined) {
      updates.unit = String(body.unit).trim() || "pcs";
    }
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity)) {
        return NextResponse.json({ error: "Valid quantity is required" }, { status: 400 });
      }
      updates.quantity = quantity;
    }
    if (body.low_stock_threshold !== undefined) {
      const threshold = Number(body.low_stock_threshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        return NextResponse.json(
          { error: "Low-stock threshold must be 0 or more" },
          { status: 400 }
        );
      }
      updates.low_stock_threshold = threshold;
    }
    if (body.notes !== undefined) {
      updates.notes = String(body.notes).trim();
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("inventory_items")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        return NextResponse.json(
          { error: "An inventory item with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      item: {
        ...data,
        quantity: Number(data.quantity),
        low_stock_threshold: Number(data.low_stock_threshold),
        notes: data.notes ?? "",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();

    // Block delete if used in a recipe
    const { data: used } = await supabase
      .from("recipe_ingredients")
      .select("id")
      .eq("inventory_item_id", params.id)
      .limit(1);

    if (used?.length) {
      return NextResponse.json(
        {
          error:
            "This item is used in one or more recipes. Remove it from recipes first.",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
